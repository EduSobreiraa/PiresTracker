import { financialCategories, type FinancialTransaction } from '../../../src/types.ts'

export function hasInstallmentIdentity(row: Pick<FinancialTransaction, 'account_id' | 'amount' | 'merchant_name' | 'purchase_date' | 'installment_number' | 'total_installments'>): boolean {
  return Boolean(row.account_id && Number.isFinite(row.amount) && row.merchant_name?.trim() && row.purchase_date
    && row.installment_number && row.total_installments && row.total_installments > 1 && row.installment_number <= row.total_installments)
}

export function inheritedInstallmentClassification(rows: { manual_category: string | null; ai_category: string | null }[]) {
  const manualCategory = rows.find((row) => financialCategories.includes(row.manual_category))?.manual_category
  if (financialCategories.includes(manualCategory)) return { category: manualCategory, manual: true }
  const aiCategory = rows.find((row) => financialCategories.includes(row.ai_category))?.ai_category
  return financialCategories.includes(aiCategory) ? { category: aiCategory, manual: false } : null
}

export function inheritedInstallmentNecessity(rows: { is_necessary: boolean | null }[]): boolean | null {
  return rows.find((row) => row.is_necessary !== null)?.is_necessary ?? null
}
