import { adminClient, authenticatedUser } from '../_shared/auth.ts'
import { isFinancialCategory } from '../../../src/types.ts'
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/http.ts'
import { hasInstallmentIdentity } from '../_shared/installment-classification.ts'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  if (request.method !== 'POST') return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405)
  try {
    const user = await authenticatedUser(request)
    let body: unknown
    try { body = await request.json() } catch { throw new Error('INVALID_REQUEST') }
    if (!isRecord(body) || typeof body.action !== 'string') throw new Error('INVALID_REQUEST')
    const isCategoryAction = body.action === 'set-manual-category'
    const isNecessityAction = body.action === 'set-manual-necessity'
    const valueKey = isCategoryAction ? 'category' : 'isNecessary'
    const valueValid = isCategoryAction ? body.category === null || isFinancialCategory(body.category)
      : isNecessityAction && (body.isNecessary === null || typeof body.isNecessary === 'boolean')
    if ((!isCategoryAction && !isNecessityAction) || Object.keys(body).length !== 3 || typeof body.transactionId !== 'string' || !uuidPattern.test(body.transactionId) || !valueValid || !(valueKey in body)) {
      throw new Error('INVALID_REQUEST')
    }
    const admin = adminClient()
    const { data: transaction, error: readError } = await admin.from('financial_transactions')
      .select('id, account_id, amount, merchant_name, purchase_date, installment_number, total_installments')
      .eq('user_id', user.id).eq('id', body.transactionId).maybeSingle()
    if (readError) throw new Error('FINANCIAL_CATEGORY_READ_FAILED')
    if (!transaction) throw new Error('TRANSACTION_NOT_FOUND')
    const canMatchInstallments = (isCategoryAction ? body.category !== null : body.isNecessary !== null) && hasInstallmentIdentity(transaction)
    let siblingIds: string[] = []
    if (canMatchInstallments) {
      const { data: siblings, error: siblingError } = await admin.from('financial_transactions').select('id')
        .eq('user_id', user.id).eq('account_id', transaction.account_id).eq('purchase_date', transaction.purchase_date)
        .eq('total_installments', transaction.total_installments).eq('merchant_name', transaction.merchant_name).eq('amount', transaction.amount)
        .neq('installment_number', transaction.installment_number)
      if (siblingError) throw new Error('FINANCIAL_CATEGORY_READ_FAILED')
      siblingIds = (siblings ?? []).map(({ id }) => id)
    }
    const update = isCategoryAction ? { manual_category: body.category } : { is_necessary: body.isNecessary }
    const { error: updateError } = await admin.from('financial_transactions').update(update)
      .eq('user_id', user.id).eq('id', transaction.id)
    if (updateError) throw new Error('FINANCIAL_CATEGORY_WRITE_FAILED')
    if (siblingIds.length) {
      const { error: siblingUpdateError } = await admin.from('financial_transactions').update(update)
        .eq('user_id', user.id).in('id', siblingIds)
      if (siblingUpdateError) throw new Error('FINANCIAL_CATEGORY_WRITE_FAILED')
    }
    return jsonResponse({ status: 'SUCCEEDED', propagatedInstallments: siblingIds.length })
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'CLASSIFICATION_FAILED'
    const status = code === 'AUTH_REQUIRED' || code === 'AUTH_INVALID' ? 401
      : code === 'INVALID_REQUEST' ? 400
      : code === 'TRANSACTION_NOT_FOUND' ? 404
      : 500
    return new Response(JSON.stringify({ error: status < 500 ? code : 'FINANCIAL_CLASSIFICATION_FAILED' }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
