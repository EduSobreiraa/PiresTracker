import { describe, expect, it } from 'vitest'
import { copilotMetrics } from './copilot-metrics.ts'

describe('copilotMetrics', () => {
  it('counts each dated occurrence once and calculates weekly and monthly adherence', () => {
    const item = { id: 'study-1', weekday: 1, starts_at: '13:00', ends_at: '13:40', title: 'Estudar', category: 'study' as const, is_trackable: true, active: true }
    const done = { routine_item_id: 'study-1', local_date: '2026-10-12', completed_at: '2026-10-12T17:00:00Z' }
    const metrics = copilotMetrics([item], [done, done], [], '2026-10-18')
    expect(metrics.routine.currentWeekToDate.study).toEqual({ planned: 1, completed: 1, percentage: 100 })
    expect(metrics.routine.currentMonthToDate.study).toEqual({ planned: 2, completed: 1, percentage: 50 })
    expect(metrics.routine.currentWeekToDate.gym).toEqual({ planned: 0, completed: 0, percentage: null })
  })

  it('calculates category totals in code', () => {
    const transaction = { transaction_date: '2026-10-15', amount: -25.5, manual_category: 'alimentacao', ai_category: null, is_necessary: null, installment_number: null, total_installments: null }
    const income = { ...transaction, amount: 100, manual_category: 'receitas' }
    const metrics = copilotMetrics([], [], [transaction, income, { ...income, transaction_date: '2026-10-06', amount: 500 }], '2026-10-18')
    expect(metrics.finance.cycles[0].expensesByCategory).toEqual({ Alimentação: 25.5 })
    expect(metrics.finance.cycles[0].classifiedExpenseTotal).toBe(25.5)
    expect(metrics.finance.incomeByCycle[0].classifiedIncome).toBe(100)
    expect(metrics.finance.incomeByCycle[1].classifiedIncome).toBe(0)
  })
})
