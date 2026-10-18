import { financialCategoryLabels, isFinancialCategory, type Completion, type FinancialCategory, type FinancialTransaction, type RoutineItem } from '../../../src/types.ts'
import { keepFinancialTransaction } from '../../../src/finance-history.ts'

type AdviceTransaction = Pick<FinancialTransaction, 'transaction_date' | 'amount' | 'manual_category' | 'ai_category' | 'is_necessary' | 'installment_number' | 'total_installments'>
type AdviceRoutineItem = Pick<RoutineItem, 'id' | 'weekday' | 'category' | 'is_trackable' | 'active'>
type AdviceCompletion = Pick<Completion, 'routine_item_id' | 'local_date' | 'completed_at'>

export const financialAdvicePrompt = `Você é um conselheiro pessoal de rotina e finanças. Responda em português brasileiro, com empatia e sem julgamento. Baseie cada afirmação somente na pergunta e no contexto agregado fornecido. Para perguntas sobre gastos, informe categoria, valor e ciclo de 10 a 9 quando disponível. Diferencie despesas categorizadas das sem categoria. Use as avaliações de necessidade marcadas pela pessoa para comentar apenas os valores que ela avaliou; não conclua por conta própria que uma compra era necessária ou desnecessária. O contexto não contém metas nem orçamento financeiro definido: não diga que o orçamento está adequado ou inadequado; explique essa limitação e peça uma meta se ela for necessária. Use o plano recorrente e as conclusões recentes para comentar estudos e academia, indicando os números observados e limites do período. O plano recorrente é o atual e pode não refletir mudanças feitas durante as quatro semanas observadas; mencione isso quando afetar a análise. Não invente compromissos, rendas, metas ou causas para os hábitos. Ofereça passos práticos e pequenos. Não recomende investimentos, empréstimos ou produtos financeiros específicos.`

export function financialAdviceStartDate(today: string): string {
  return dateOnly(shiftMonth(cycleStart(today), -5))
}

export function buildFinancialAdviceContext(transactions: AdviceTransaction[], routineItems: AdviceRoutineItem[], completions: AdviceCompletion[], today: string) {
  const cycles = Array.from({ length: 6 }, (_, index) => {
    const fromDate = shiftMonth(cycleStart(today), -index)
    const from = dateOnly(fromDate)
    const to = dateOnly(new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + 1, 9)))
    const expensesByCategory = new Map<FinancialCategory, number>()
    let unclassifiedExpenseAmount = 0
    let unclassifiedExpenseCount = 0
    let necessaryExpenseAmount = 0
    let unnecessaryExpenseAmount = 0
    let assessedExpenseCount = 0

    for (const transaction of transactions) {
      if (!keepFinancialTransaction(transaction)) continue
      if (transaction.transaction_date < from || transaction.transaction_date > to || transaction.transaction_date > today || transaction.amount >= 0) continue
      const category = isFinancialCategory(transaction.manual_category) ? transaction.manual_category : transaction.ai_category
      if (!isFinancialCategory(category)) {
        unclassifiedExpenseAmount += Math.abs(transaction.amount)
        unclassifiedExpenseCount++
      } else if (category === 'receitas' || category === 'transferencias') {
        continue
      } else {
        expensesByCategory.set(category, (expensesByCategory.get(category) ?? 0) + Math.abs(transaction.amount))
      }
      if (transaction.is_necessary !== null && transaction.is_necessary !== undefined) {
        assessedExpenseCount++
        if (transaction.is_necessary) necessaryExpenseAmount += Math.abs(transaction.amount)
        else unnecessaryExpenseAmount += Math.abs(transaction.amount)
      }
    }

    const categories = Object.fromEntries([...expensesByCategory].map(([category, amount]) => [financialCategoryLabels[category], Number(amount.toFixed(2))]))
    return {
      from,
      to,
      expensesByCategory: categories,
      classifiedExpenseTotal: Number([...expensesByCategory.values()].reduce((sum, amount) => sum + amount, 0).toFixed(2)),
      unclassifiedExpenseCount,
      unclassifiedExpenseAmount: Number(unclassifiedExpenseAmount.toFixed(2)),
      necessityAssessment: { necessaryExpenseAmount: Number(necessaryExpenseAmount.toFixed(2)), unnecessaryExpenseAmount: Number(unnecessaryExpenseAmount.toFixed(2)), assessedExpenseCount },
    }
  })

  const trackedItems = routineItems.filter((item) => item.active && item.is_trackable && (item.category === 'study' || item.category === 'gym'))
  const plannedWeekly = { study: trackedItems.filter((item) => item.category === 'study').length, gym: trackedItems.filter((item) => item.category === 'gym').length }
  const completedKeys = new Set(completions.filter((item) => item.completed_at && item.local_date <= today).map((item) => `${item.routine_item_id}:${item.local_date}`))
  const recentRoutine = { from: addDays(today, -27), to: today, study: { planned: 0, completed: 0 }, gym: { planned: 0, completed: 0 } }
  for (let date = recentRoutine.from; date <= today; date = addDays(date, 1)) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    for (const item of trackedItems) {
      if (item.category !== 'study' && item.category !== 'gym') continue
      if (item.weekday !== weekday) continue
      const category = item.category === 'study' ? recentRoutine.study : recentRoutine.gym
      category.planned++
      if (completedKeys.has(`${item.id}:${date}`)) category.completed++
    }
  }

  return { currency: 'BRL', cycleDefinition: '10th through 9th', cycles, financialBudgetTargets: null, routine: { plannedWeekly, recent28Days: recentRoutine } }
}

function cycleStart(date: string): Date {
  const current = new Date(`${date}T00:00:00Z`)
  return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - (current.getUTCDate() < 10 ? 1 : 0), 10))
}

function shiftMonth(date: Date, amount: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 10))
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return dateOnly(value)
}
