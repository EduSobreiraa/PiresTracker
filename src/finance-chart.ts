import { financialCategories, isFinancialCategory, type FinancialCategory, type FinancialTransaction } from './types'

export function spendingByCategory(transactions: Pick<FinancialTransaction, 'transaction_date' | 'amount' | 'manual_category' | 'ai_category'>[], today: string) {
  const current = new Date(`${today}T00:00:00Z`)
  const year = current.getUTCFullYear()
  const month = current.getUTCMonth()
  const fromDate = current.getUTCDate() >= 10 ? new Date(Date.UTC(year, month, 10)) : new Date(Date.UTC(year, month - 1, 10))
  const toDate = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + 1, 9))
  const from = fromDate.toISOString().slice(0, 10)
  const to = toDate.toISOString().slice(0, 10)
  const totals = new Map<FinancialCategory, number>(financialCategories.map((category) => [category, 0]))
  let uncategorizedAmount = 0
  let uncategorizedCount = 0

  for (const transaction of transactions) {
    if (transaction.transaction_date < from || transaction.transaction_date > to || transaction.amount >= 0) continue
    const category = isFinancialCategory(transaction.manual_category) ? transaction.manual_category : transaction.ai_category
    if (!isFinancialCategory(category)) {
      uncategorizedAmount += Math.abs(transaction.amount)
      uncategorizedCount++
      continue
    }
    if (category === 'receitas' || category === 'transferencias') {
      continue
    }
    totals.set(category, (totals.get(category) ?? 0) + Math.abs(transaction.amount))
  }

  const items = [...totals].filter(([, amount]) => amount > 0).map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount)
  return { from, to, items, total: items.reduce((sum, item) => sum + item.amount, 0), uncategorizedAmount, uncategorizedCount }
}
