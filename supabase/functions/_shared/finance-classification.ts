import { adminClient } from './auth.ts'
import { financialCategories } from '../../../src/types.ts'
import { hasInstallmentIdentity, inheritedInstallmentClassification, inheritedInstallmentNecessity } from './installment-classification.ts'

const batchSize = 25

export async function inheritNewInstallmentCategories(ownerId: string, createdAfter: string): Promise<{ attempted: number; inherited: number }> {
  const admin = adminClient()
  let cursor = ''
  let attempted = 0
  let inheritedCount = 0
  while (true) {
    let query = admin.from('financial_transactions').select('id, account_id, merchant_name, amount, installment_number, total_installments, purchase_date')
      .eq('user_id', ownerId).gt('created_at', createdAfter)
      .is('manual_category', null).is('ai_category', null).is('is_necessary', null).not('installment_number', 'is', null)
      .gt('total_installments', 1).not('purchase_date', 'is', null).not('merchant_name', 'is', null)
      .order('id').limit(batchSize)
    if (cursor) query = query.gt('id', cursor)
    const { data, error } = await query
    if (error) throw new Error('FINANCIAL_CLASSIFICATION_READ_FAILED')
    if (!data.length) break
    const lastRow = data[data.length - 1]
    if (!lastRow) break
    cursor = lastRow.id
    attempted += data.length
    const matches = await Promise.all(data.map(async (row) => {
      if (!hasInstallmentIdentity(row)) return { id: row.id, classification: null, necessity: null }
      const { data: previous, error: previousError } = await admin.from('financial_transactions')
        .select('manual_category, ai_category, is_necessary')
        .eq('user_id', ownerId).eq('account_id', row.account_id).eq('purchase_date', row.purchase_date)
        .eq('total_installments', row.total_installments).eq('merchant_name', row.merchant_name).eq('amount', row.amount)
        .neq('installment_number', row.installment_number).order('installment_number')
      if (previousError) throw new Error('FINANCIAL_CLASSIFICATION_READ_FAILED')
      return { id: row.id, classification: inheritedInstallmentClassification(previous ?? []), necessity: inheritedInstallmentNecessity(previous ?? []) }
    }))
    const necessityIds = matches.filter(({ necessity }) => necessity !== null).map(({ id }) => id)
    if (necessityIds.length) {
      const value = matches.find(({ necessity }) => necessity !== null)?.necessity
      const { error: updateError } = await admin.from('financial_transactions').update({ is_necessary: value })
        .eq('user_id', ownerId).is('is_necessary', null).in('id', necessityIds)
      if (updateError) throw new Error('FINANCIAL_CLASSIFICATION_WRITE_FAILED')
    }
    for (const category of financialCategories) {
      for (const manual of [true, false]) {
        const ids = matches.filter(({ classification }) => classification?.category === category && classification?.manual === manual).map(({ id }) => id)
        if (!ids.length) continue
        const update = manual ? { manual_category: category } : { ai_category: category, ai_classified_at: new Date().toISOString() }
        const { data: updated, error: updateError } = await admin.from('financial_transactions').update(update)
          .eq('user_id', ownerId).is('manual_category', null).is('ai_category', null).in('id', ids).select('id')
        if (updateError) throw new Error('FINANCIAL_CLASSIFICATION_WRITE_FAILED')
        inheritedCount += updated.length
      }
    }
  }
  return { attempted, inherited: inheritedCount }
}
