import { describe, expect, it, vi } from 'vitest'
import { normalizeAccount, normalizeBill, normalizeTransaction } from './finance-normalization.ts'
import { createPluggyFinanceClient } from './pluggy-finance.ts'

const itemId = '10000000-0000-4000-8000-000000000001'
const accountId = '20000000-0000-4000-8000-000000000001'
const transactionId = '30000000-0000-4000-8000-000000000001'
const syncedAt = '2026-10-13T12:00:00.000Z'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('Pluggy finance API client', () => {
  it('reads every bills page using page-number pagination', async () => {
    const paths: string[] = []
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      paths.push(`${url.pathname}${url.search}`)
      const page = Number(url.searchParams.get('page'))
      return jsonResponse({ page, totalPages: 2, results: [{ id: `bill-${page}` }] })
    })
    const client = createPluggyFinanceClient('test-key', { fetcher, wait: async () => {} })

    const bills = await client.listBills(accountId)

    expect(bills).toEqual([{ id: 'bill-1' }, { id: 'bill-2' }])
    expect(paths).toEqual([
      `/bills?accountId=${accountId}&page=1&pageSize=500`,
      `/bills?accountId=${accountId}&page=2&pageSize=500`,
    ])
  })

  it('reads every accounts page for the requested Item', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const page = Number(new URL(String(input)).searchParams.get('page'))
      return jsonResponse({ page, totalPages: 2, results: [{ id: `account-${page}` }] })
    })
    const client = createPluggyFinanceClient('test-key', { fetcher, wait: async () => {} })

    await expect(client.listAccounts(itemId)).resolves.toEqual([{ id: 'account-1' }, { id: 'account-2' }])
  })

  it('follows the Pluggy cursor while keeping the account scope', async () => {
    const paths: string[] = []
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      paths.push(`${url.pathname}${url.search}`)
      if (!url.searchParams.has('after')) {
        return jsonResponse({ results: [{ id: 'first' }], next: `?accountId=${accountId}&after=cursor-1` })
      }
      return jsonResponse({ results: [{ id: 'second' }], next: null })
    })
    const client = createPluggyFinanceClient('test-key', { fetcher, wait: async () => {} })

    await expect(client.listTransactions(accountId)).resolves.toEqual([{ id: 'first' }, { id: 'second' }])
    expect(paths).toEqual([
      `/v2/transactions?accountId=${accountId}`,
      `/v2/transactions?accountId=${accountId}&after=cursor-1`,
    ])
  })

  it('rejects a cursor that changes the account scope', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse({ results: [], next: '?accountId=other&after=cursor' }))
    const client = createPluggyFinanceClient('test-key', { fetcher, wait: async () => {} })

    await expect(client.listTransactions(accountId)).rejects.toThrow('PLUGGY_PAGINATION_INVALID')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('retries a transient Pluggy server error and returns the successful response', async () => {
    const waits: number[] = []
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: 'bill' }], totalPages: 1 }))
    const client = createPluggyFinanceClient('test-key', { fetcher, wait: async (milliseconds) => { waits.push(milliseconds) } })

    await expect(client.listBills(accountId)).resolves.toEqual([{ id: 'bill' }])
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(waits).toEqual([250])
  })
})

describe('Pluggy finance normalization', () => {
  it('stores only account fields used by the PiresTracker', () => {
    const account = normalizeAccount({
      id: accountId,
      itemId,
      type: 'BANK',
      subtype: 'CHECKING_ACCOUNT',
      name: ' Conta corrente ',
      currencyCode: 'brl',
      balance: 1200.5,
      number: '12345-6',
      owner: 'Nome pessoal',
      taxNumber: '000.000.000-00',
      bankData: { transferNumber: 'agencia/conta', automaticallyInvestedBalance: 12 },
    }, { userId: 'owner', connectionId: 'connection', itemId, syncedAt })

    expect(account).toMatchObject({ account_type: 'BANK', name: 'Conta corrente', currency_code: 'BRL', balance: 1200.5 })
    expect(account.details).toEqual({})
    expect(JSON.stringify(account)).not.toContain('000.000.000-00')
    expect(JSON.stringify(account)).not.toContain('agencia/conta')
  })

  it('stores normalized transaction fields without retaining raw payment data', () => {
    const transaction = normalizeTransaction({
      id: transactionId,
      accountId,
      date: '2026-10-13T00:00:00.000Z',
      amount: -55.9,
      currencyCode: 'BRL',
      description: 'Compra parcelada',
      type: 'DEBIT',
      status: 'PENDING',
      category: 'Shopping',
      operationType: 'PAGAMENTO',
      merchant: { name: 'Loja' },
      paymentData: { receiver: { name: 'Loja', documentNumber: 'dados preservados' } },
      creditCardMetadata: { installmentNumber: 2, totalInstallments: 6, purchaseDate: '2026-09-13T00:00:00Z', billId: 'bill-id', billForecastDate: '2026-11' },
    }, { userId: 'owner', accountId: 'local-account', externalAccountId: accountId, syncedAt })

    expect(transaction).toMatchObject({
      status: 'PENDING',
      provider_type: 'DEBIT',
      provider_category: 'Shopping',
      merchant_name: 'Loja',
      installment_number: 2,
      total_installments: 6,
      external_bill_id: 'bill-id',
      bill_forecast_month: '2026-11',
      transaction_date: '2026-10-13',
    })
    expect(transaction.raw_metadata).toEqual({})
    expect(JSON.stringify(transaction)).not.toContain('dados preservados')
    expect('manual_category' in transaction).toBe(false)
  })

  it('rejects a transaction from another account', () => {
    expect(() => normalizeTransaction({
      id: transactionId, accountId: '20000000-0000-4000-8000-000000000002', date: '2026-10-13', amount: 1,
      currencyCode: 'BRL', description: 'Compra', status: 'POSTED',
    }, { userId: 'owner', accountId: 'local-account', externalAccountId: accountId, syncedAt })).toThrow('PLUGGY_TRANSACTION_ACCOUNT_MISMATCH')
  })

  it('normalizes bill dates and amounts without deriving payment status', () => {
    const bill = normalizeBill({
      id: 'bill-id', dueDate: '2026-10-20T00:00:00', billClosingDate: '2026-10-13T00:00:00',
      totalAmount: 320, totalAmountCurrencyCode: 'BRL', minimumPaymentAmount: 32,
      allowsInstallments: true, payments: [], financeCharges: [],
    }, { userId: 'owner', accountId: 'local-account', syncedAt })

    expect(bill).toMatchObject({ external_bill_id: 'bill-id', due_date: '2026-10-20', closing_date: '2026-10-13', total_amount: 320, allows_installments: true })
    expect(bill).not.toHaveProperty('status')
    expect(bill.raw_metadata).toEqual({})
  })
})
