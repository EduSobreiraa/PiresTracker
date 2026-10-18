import { buildFinancialAdviceContext } from './finance-advice.ts'
import { keepFinancialTransaction } from '../../../src/finance-history.ts'
import { isFinancialCategory, type Completion, type FinancialTransaction, type RoutineItem } from '../../../src/types.ts'

type Item = Pick<RoutineItem, 'id' | 'weekday' | 'starts_at' | 'ends_at' | 'title' | 'category' | 'is_trackable' | 'active'>
type Done = Pick<Completion, 'routine_item_id' | 'local_date' | 'completed_at'>
type Transaction = Pick<FinancialTransaction, 'transaction_date' | 'amount' | 'manual_category' | 'ai_category' | 'is_necessary' | 'installment_number' | 'total_installments'>

export function copilotMetrics(items: Item[], completions: Done[], transactions: Transaction[], today: string) {
  const financial = buildFinancialAdviceContext(transactions, items, completions, today)
  const incomeByCycle = financial.cycles.map((cycle) => {
    let classifiedIncome = 0
    let unclassifiedPositive = 0
    for (const entry of transactions) {
      if (!keepFinancialTransaction(entry) || entry.transaction_date < cycle.from || entry.transaction_date > cycle.to || entry.transaction_date > today || entry.amount <= 0) continue
      const category = isFinancialCategory(entry.manual_category) ? entry.manual_category : entry.ai_category
      if (category === 'receitas') classifiedIncome += entry.amount
      else if (category !== 'transferencias') unclassifiedPositive += entry.amount
    }
    return { from: cycle.from, to: cycle.to, classifiedIncome: Number(classifiedIncome.toFixed(2)), unclassifiedPositive: Number(unclassifiedPositive.toFixed(2)) }
  })
  const completed = new Set(completions.filter((entry) => entry.completed_at).map((entry) => `${entry.routine_item_id}:${entry.local_date}`))
  const start = new Date(`${today}T00:00:00Z`)
  const from = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
  const monthly = { study: { planned: 0, completed: 0 }, gym: { planned: 0, completed: 0 } }
  const weekly = { study: { planned: 0, completed: 0 }, gym: { planned: 0, completed: 0 } }
  const weekStart = new Date(start)
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7))
  for (let date = new Date(from); date <= start; date.setUTCDate(date.getUTCDate() + 1)) {
    const dateOnly = date.toISOString().slice(0, 10)
    for (const item of items) {
      if (!item.active || !item.is_trackable || item.weekday !== date.getUTCDay() || (item.category !== 'study' && item.category !== 'gym')) continue
      const group = monthly[item.category]
      group.planned++
      if (completed.has(`${item.id}:${dateOnly}`)) group.completed++
      if (date >= weekStart) {
        weekly[item.category].planned++
        if (completed.has(`${item.id}:${dateOnly}`)) weekly[item.category].completed++
      }
    }
  }
  const withRate = (group: { planned: number; completed: number }) => ({ ...group, percentage: group.planned ? Math.round(100 * group.completed / group.planned) : null })
  return {
    routine: { currentMonthToDate: { study: withRate(monthly.study), gym: withRate(monthly.gym) }, currentWeekToDate: { study: withRate(weekly.study), gym: withRate(weekly.gym) }, limitation: 'A rotina recorrente atual é usada como plano histórico; mudanças anteriores podem alterar a comparação.' },
    finance: { ...financial, incomeByCycle },
  }
}
