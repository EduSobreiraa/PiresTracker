import type { FinancialBill, FinancialTransaction } from './types'

export const financialCleanupCutoff = '2026-10-07'

export function keepFinancialTransaction(transaction: Pick<FinancialTransaction, 'transaction_date' | 'amount' | 'installment_number' | 'total_installments'>): boolean {
  const isInstallment = (transaction.total_installments ?? 0) > 1 || (transaction.installment_number ?? 0) > 1
  return transaction.amount >= 0 || transaction.transaction_date >= financialCleanupCutoff || isInstallment
}

export function needsFinancialCategory(transaction: Pick<FinancialTransaction, 'transaction_date' | 'amount' | 'installment_number' | 'total_installments' | 'manual_category' | 'ai_category'>): boolean {
  return keepFinancialTransaction(transaction) && transaction.manual_category === null && transaction.ai_category === null
}

export function currentCardBill(
  bills: Pick<FinancialBill, 'due_date' | 'total_amount' | 'currency_code' | 'minimum_payment_amount'>[],
  transactions: Pick<FinancialTransaction, 'account_id' | 'amount' | 'currency_code' | 'operation_type' | 'bill_forecast_month' | 'bill_post_date'>[],
  accountIds: Set<string>, currency: string, today: string,
) {
  const upcoming = bills.filter((bill) => bill.due_date >= today && bill.currency_code === currency)
    .sort((left, right) => left.due_date.localeCompare(right.due_date))[0]
  if (upcoming) return { kind: 'imported' as const, bill: upcoming }

  const latestDueDate = bills.filter((bill) => bill.currency_code === currency)
    .reduce((latest, bill) => bill.due_date > latest ? bill.due_date : latest, '')
  const nextMonth = latestDueDate
    ? new Date(Date.UTC(Number(latestDueDate.slice(0, 4)), Number(latestDueDate.slice(5, 7)), 1)).toISOString().slice(0, 7)
    : transactions.filter((transaction) => accountIds.has(transaction.account_id) && transaction.currency_code === currency && transaction.operation_type !== 'PAGAMENTO_FATURA')
      .map((transaction) => transaction.bill_forecast_month ?? transaction.bill_post_date?.slice(0, 7) ?? '')
      .filter((forecastMonth) => forecastMonth >= today.slice(0, 7)).sort()[0] ?? today.slice(0, 7)
  const month = nextMonth > today.slice(0, 7) ? nextMonth : today.slice(0, 7)
  const charges = transactions.filter((transaction) => accountIds.has(transaction.account_id)
    && transaction.currency_code === currency
    && transaction.operation_type !== 'PAGAMENTO_FATURA'
    && (transaction.bill_forecast_month === month || (!transaction.bill_forecast_month && transaction.bill_post_date?.slice(0, 7) === month)))
  if (!charges.length) return { kind: 'unavailable' as const }
  return { kind: 'forecast' as const, month, amount: charges.reduce((cents, transaction) => cents + Math.round(transaction.amount * 100), 0) / 100 }
}
