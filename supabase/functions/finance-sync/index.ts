import { adminClient, authenticatedUser } from '../_shared/auth.ts'
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/http.ts'
import { getItem, createApiKey } from '../_shared/pluggy.ts'
import { createPluggyFinanceClient } from '../_shared/pluggy-finance.ts'
import { normalizeAccount, normalizeBill, normalizeTransaction } from '../_shared/finance-normalization.ts'
import { inheritNewInstallmentCategories } from '../_shared/finance-classification.ts'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const batchSize = 100

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function connectionIdFrom(value: unknown): string {
  if (!isRecord(value) || Object.keys(value).length !== 1) throw new Error('INVALID_REQUEST')
  const connectionId = value.connectionId
  if (typeof connectionId !== 'string' || !uuidPattern.test(connectionId)) throw new Error('INVALID_REQUEST')
  return connectionId
}

function errorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return /^[A-Z][A-Z0-9_]{0,79}$/.test(message) ? message : 'SYNC_FAILED'
}

async function saveBatches<T>(rows: T[], save: (batch: T[]) => Promise<void>): Promise<void> {
  for (let start = 0; start < rows.length; start += batchSize) {
    await save(rows.slice(start, start + batchSize))
  }
}

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405)

  try {
    const user = await authenticatedUser(request)
    let requestBody: unknown
    try {
      requestBody = await request.json()
    } catch {
      throw new Error('INVALID_REQUEST')
    }
    const connectionId = connectionIdFrom(requestBody)
    const admin = adminClient()
    const { data: connection, error: connectionError } = await admin
      .from('financial_connections')
      .select('id, user_id, external_item_id, status, last_synced_at, classification_checkpoint_at')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (connectionError) throw new Error('FINANCIAL_DATABASE_READ_FAILED')
    if (!connection) throw new Error('CONNECTION_NOT_FOUND')
    if (connection.status !== 'ACTIVE') throw new Error('CONNECTION_NOT_ACTIVE')

    const { data: execution, error: executionError } = await admin
      .from('financial_sync_executions')
      .insert({ user_id: user.id, connection_id: connection.id, status: 'RUNNING' })
      .select('id')
      .single()
    if (executionError || !execution) throw new Error('FINANCIAL_SYNC_START_FAILED')

    let accountsCount = 0
    let transactionsCount = 0
    let billsCount = 0
    try {
      const apiKey = await createApiKey()
      const item = await getItem(apiKey, connection.external_item_id)
      if (item.connector.id !== 200) throw new Error('PLUGGY_ITEM_NOT_MEUPLUGGY')
      const pluggy = createPluggyFinanceClient(apiKey)
      const syncedAt = new Date().toISOString()

      const rawAccounts = await pluggy.listAccounts(connection.external_item_id)
      const accountsByExternalId = new Map<string, ReturnType<typeof normalizeAccount>>()
      for (const rawAccount of rawAccounts) {
        const account = normalizeAccount(rawAccount, {
          userId: user.id,
          connectionId: connection.id,
          itemId: connection.external_item_id,
          syncedAt,
        })
        accountsByExternalId.set(account.external_account_id, account)
      }
      const accounts = Array.from(accountsByExternalId.values())
      const localAccounts = new Map<string, { id: string; account_type: 'BANK' | 'CREDIT' }>()
      await saveBatches(accounts, async (batch) => {
        const { data, error } = await admin.from('financial_accounts')
          .upsert(batch, { onConflict: 'connection_id,external_account_id' })
          .select('id, external_account_id, account_type')
        if (error || !data) throw new Error('FINANCIAL_ACCOUNT_WRITE_FAILED')
        for (const account of data) localAccounts.set(account.external_account_id, { id: account.id, account_type: account.account_type })
        accountsCount += batch.length
      })

      const billsByKey = new Map<string, ReturnType<typeof normalizeBill>>()
      const transactionsByKey = new Map<string, ReturnType<typeof normalizeTransaction>>()
      for (const [externalAccountId, localAccount] of localAccounts) {
        if (localAccount.account_type === 'CREDIT') {
          for (const rawBill of await pluggy.listBills(externalAccountId)) {
            const bill = normalizeBill(rawBill, { userId: user.id, accountId: localAccount.id, syncedAt })
            billsByKey.set(`${localAccount.id}:${bill.external_bill_id}`, bill)
          }
        }
        for (const rawTransaction of await pluggy.listTransactions(externalAccountId)) {
          const transaction = normalizeTransaction(rawTransaction, {
            userId: user.id,
            accountId: localAccount.id,
            externalAccountId,
            syncedAt,
          })
          transactionsByKey.set(`${localAccount.id}:${transaction.external_transaction_id}`, transaction)
        }
      }

      const bills = Array.from(billsByKey.values())
      await saveBatches(bills, async (batch) => {
        const { error } = await admin.from('financial_bills')
          .upsert(batch, { onConflict: 'account_id,external_bill_id' })
        if (error) throw new Error('FINANCIAL_BILL_WRITE_FAILED')
        billsCount += batch.length
      })

      const transactions = Array.from(transactionsByKey.values())
      await saveBatches(transactions, async (batch) => {
        const { error } = await admin.from('financial_transactions')
          .upsert(batch, { onConflict: 'account_id,external_transaction_id' })
        if (error) throw new Error('FINANCIAL_TRANSACTION_WRITE_FAILED')
        transactionsCount += batch.length
      })

      let classification: { inherited: number; error?: string } = { inherited: 0 }
      let advanceClassificationCheckpoint = true
      if (connection.classification_checkpoint_at) {
        try {
          const result = await inheritNewInstallmentCategories(user.id, connection.classification_checkpoint_at)
          classification = { inherited: result.inherited }
        } catch (cause) {
          classification.error = errorCode(cause)
          advanceClassificationCheckpoint = false
        }
      }

      const finishedAt = new Date().toISOString()
      const connectionUpdate: { last_synced_at: string; classification_checkpoint_at?: string } = { last_synced_at: finishedAt }
      if (advanceClassificationCheckpoint) connectionUpdate.classification_checkpoint_at = finishedAt
      const { error: connectionUpdateError } = await admin.from('financial_connections')
        .update(connectionUpdate)
        .eq('id', connection.id)
        .eq('user_id', user.id)
      if (connectionUpdateError) throw new Error('FINANCIAL_CONNECTION_UPDATE_FAILED')

      const { error: executionUpdateError } = await admin.from('financial_sync_executions')
        .update({ status: 'SUCCEEDED', accounts_count: accountsCount, transactions_count: transactionsCount, bills_count: billsCount, finished_at: finishedAt })
        .eq('id', execution.id)
        .eq('user_id', user.id)
      if (executionUpdateError) throw new Error('FINANCIAL_SYNC_FINISH_FAILED')

      return jsonResponse({ syncId: execution.id, status: 'SUCCEEDED', accountsCount, transactionsCount, billsCount, classification })
    } catch (cause) {
      const code = errorCode(cause)
      const finishedAt = new Date().toISOString()
      await admin.from('financial_sync_executions')
        .update({ status: 'FAILED', accounts_count: accountsCount, transactions_count: transactionsCount, bills_count: billsCount, error_code: code, finished_at: finishedAt })
        .eq('id', execution.id)
        .eq('user_id', user.id)
      const status = code.startsWith('PLUGGY_') ? 502 : 500
      return jsonResponse({ error: 'FINANCE_SYNC_FAILED', syncId: execution.id }, status)
    }
  } catch (cause) {
    const code = errorCode(cause)
    const status = code === 'AUTH_REQUIRED' || code === 'AUTH_INVALID' ? 401
      : code === 'INVALID_REQUEST' ? 400
      : code === 'CONNECTION_NOT_FOUND' ? 404
      : code === 'CONNECTION_NOT_ACTIVE' ? 409
      : 500
    return new Response(JSON.stringify({ error: status < 500 ? code : 'FINANCE_SYNC_FAILED' }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
