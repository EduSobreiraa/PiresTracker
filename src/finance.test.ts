import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createDataAccess } from './data'
import type { Database } from './types'

const ownerId = '00000000-0000-4000-8000-000000000501'
const connectionId = '00000000-0000-4000-8000-000000000502'

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
          return Response.json({ status: 'SUCCEEDED', accountsCount: 2, transactionsCount: 3, billsCount: 1 })
        }
        const table = url.pathname.split('/').at(-1) ?? ''
        requestedTables.push(table)
        requestedQueries.push(url)
        const rows: Record<string, unknown[]> = {
          financial_connections: [{ id: connectionId, user_id: ownerId, provider: 'pluggy', external_item_id: 'private-item-id', institution_name: 'Nubank', status: 'ACTIVE', last_synced_at: null, next_auto_sync_at: null, consent_expires_at: null, created_at: '2026-10-13T00:00:00Z', updated_at: '2026-10-13T00:00:00Z' }],
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
    expect(requestedTables.sort()).toEqual(['financial_accounts', 'financial_archived_transactions', 'financial_bills', 'financial_connections', 'financial_sync_executions', 'financial_transactions'])
    expect(requestedQueries.every((url) => url.searchParams.get('user_id') === `eq.${ownerId}`)).toBe(true)

    await expect(dataAccess.syncFinancialConnection(connectionId)).resolves.toEqual({ accountsCount: 2, transactionsCount: 3, billsCount: 1 })
    expect(syncBody).toEqual({ connectionId })
  })

  it('rejects a sync response that does not report success', async () => {
    const client = createClient<Database>('https://finance.test.supabase.co', 'publishable-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async () => Response.json({ status: 'FAILED', accountsCount: 0, transactionsCount: 0, billsCount: 0 }) },
    })

    await expect(createDataAccess(client, ownerId).syncFinancialConnection(connectionId)).rejects.toThrow('A sincronização terminou sem um resumo válido.')
  })
})
