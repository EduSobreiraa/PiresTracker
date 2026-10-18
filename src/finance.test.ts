import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createDataAccess } from './data'
import { currentCardBill, keepFinancialTransaction, needsFinancialCategory } from './finance-history'
import type { Database } from './types'

const ownerId = '00000000-0000-4000-8000-000000000501'
const connectionId = '00000000-0000-4000-8000-000000000502'

describe('financial history cutoff', () => {
  it('hides every transaction before October 7, including credits and installments', () => {
    const base = { amount: -20, transaction_date: '2026-10-06', installment_number: null, total_installments: null }
    const installment = { ...base, installment_number: 1, total_installments: 3 }
    const credit = { ...base, amount: 20 }
    expect(keepFinancialTransaction(base)).toBe(false)
    expect(keepFinancialTransaction(installment)).toBe(false)
    expect(keepFinancialTransaction({ ...base, transaction_date: '2026-10-07' })).toBe(true)
    expect(keepFinancialTransaction(credit)).toBe(false)
  })
})

describe('financial presentation', () => {
  it('lists only transactions without either manual or AI category', () => {
    const base = { amount: 20, transaction_date: '2026-10-18', installment_number: null, total_installments: null, manual_category: null, ai_category: null }
    expect(needsFinancialCategory(base)).toBe(true)
    expect(needsFinancialCategory({ ...base, transaction_date: '2026-10-06' })).toBe(false)
    expect(needsFinancialCategory({ ...base, manual_category: 'compras' })).toBe(false)
    expect(needsFinancialCategory({ ...base, ai_category: 'compras' })).toBe(false)
  })

  it('estimates only the current open bill month, excluding later installments and bill payments', () => {
    const bills = [{ due_date: '2026-10-14', total_amount: 975.12, currency_code: 'BRL', minimum_payment_amount: null }]
    const charge = { account_id: 'nubank', amount: 200, currency_code: 'BRL', operation_type: 'PAGAMENTO', bill_forecast_month: '2026-11', bill_post_date: null }
    const transactions = [
      charge,
      { ...charge, amount: 86.65, bill_forecast_month: null, bill_post_date: '2026-11-01' },
      { ...charge, amount: 100, bill_forecast_month: '2026-12' },
      { ...charge, amount: -975.12, operation_type: 'PAGAMENTO_FATURA' },
      { ...charge, account_id: 'other', amount: 50 },
    ]
    expect(currentCardBill(bills, transactions, new Set(['nubank']), 'BRL', '2026-10-18'))
      .toEqual({ kind: 'forecast', month: '2026-11', amount: 286.65 })
    expect(currentCardBill(bills, transactions, new Set(['nubank']), 'BRL', '2026-10-10'))
      .toEqual({ kind: 'imported', bill: bills[0] })
    expect(currentCardBill(bills, [], new Set(['nubank']), 'BRL', '2026-10-18'))
      .toEqual({ kind: 'unavailable' })
    expect(currentCardBill([], [{ ...charge, bill_forecast_month: '2026-12' }], new Set(['nubank']), 'BRL', '2026-10-18'))
      .toEqual({ kind: 'forecast', month: '2026-12', amount: 200 })
  })
})

describe('financial data access', () => {
  it('loads owner-scoped records and syncs by local connection id', async () => {
    const requestedTables: string[] = []
    const requestedQueries: URL[] = []
    let syncBody: unknown
    const client = createClient<Database>('https://finance.test.supabase.co', 'publishable-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input))
        if (url.pathname.endsWith('/functions/v1/finance-sync')) {
          syncBody = JSON.parse(String(init?.body))
          return Response.json({ status: 'SUCCEEDED', accountsCount: 2, transactionsCount: 3, billsCount: 1, classification: { inherited: 1 } })
        }
        const table = url.pathname.split('/').at(-1) ?? ''
        requestedTables.push(table)
        requestedQueries.push(url)
        const rows: Record<string, unknown[]> = {
          financial_connections: [{ id: connectionId, user_id: ownerId, provider: 'pluggy', external_item_id: 'private-item-id', institution_name: 'Nubank', status: 'ACTIVE', last_synced_at: null, classification_checkpoint_at: null, next_auto_sync_at: null, consent_expires_at: null, created_at: '2026-10-13T00:00:00Z', updated_at: '2026-10-13T00:00:00Z' }],
          financial_accounts: [],
          financial_transactions: [{ id: 'transaction-1', user_id: ownerId, account_id: 'account-1', external_transaction_id: 'provider-transaction', transaction_date: '2026-10-12', amount: -42.5, currency_code: 'BRL', description: 'Mercado', merchant_name: 'Mercado', provider_type: 'DEBIT', operation_type: 'PAGAMENTO', status: 'PENDING', provider_category: 'Groceries', manual_category: null, installment_number: null, total_installments: null, purchase_date: null, external_bill_id: null, bill_post_date: null, bill_forecast_month: null, raw_metadata: {}, last_synced_at: '2026-10-13T00:00:00Z', created_at: '2026-10-13T00:00:00Z', updated_at: '2026-10-13T00:00:00Z' }],
          financial_bills: [],
          financial_sync_executions: [],
        }
        return Response.json(rows[table] ?? [])
      } },
    })
    const dataAccess = createDataAccess(client, ownerId)

    const workspace = await dataAccess.loadFinancialWorkspace()
    expect(workspace.connections.map(({ institution_name }) => institution_name)).toEqual(['Nubank'])
    expect(workspace.transactions.map(({ description, status }) => [description, status])).toEqual([['Mercado', 'PENDING']])
    expect(requestedTables.sort()).toEqual(['financial_accounts', 'financial_bills', 'financial_connections', 'financial_sync_executions', 'financial_transactions'])
    expect(requestedQueries.every((url) => url.searchParams.get('user_id') === `eq.${ownerId}`)).toBe(true)
    expect(requestedQueries.find((url) => url.pathname.endsWith('/financial_transactions'))?.searchParams.get('transaction_date')).toBe('gte.2026-10-07')

    await expect(dataAccess.syncFinancialConnection(connectionId)).resolves.toEqual({ accountsCount: 2, transactionsCount: 3, billsCount: 1, inheritedInstallmentsCount: 1, classificationError: null })
    expect(syncBody).toEqual({ connectionId })
  })

  it('rejects a sync response that does not report success', async () => {
    const client = createClient<Database>('https://finance.test.supabase.co', 'publishable-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async () => Response.json({ status: 'FAILED', accountsCount: 0, transactionsCount: 0, billsCount: 0 }) },
    })

    await expect(createDataAccess(client, ownerId).syncFinancialConnection(connectionId)).rejects.toThrow('A sincronização terminou sem um resumo válido.')
  })

  it('saves manual categories through the owner-scoped categorization action', async () => {
    const requests: unknown[] = []
    const client = createClient<Database>('https://finance.test.supabase.co', 'publishable-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        if (!String(input).includes('/functions/v1/finance-categorize')) return Response.json({})
        requests.push(JSON.parse(String(init?.body)))
        return Response.json({ status: 'SUCCEEDED' })
      } },
    })
    const dataAccess = createDataAccess(client, ownerId)

    await expect(dataAccess.saveFinancialCategory('transaction-id', 'alimentacao')).resolves.toBeUndefined()
    expect(requests).toEqual([
      { action: 'set-manual-category', transactionId: 'transaction-id', category: 'alimentacao' },
    ])
  })

})
