import { describe, expect, it } from 'vitest'
import { buildFinancialAdviceContext, financialAdviceStartDate } from './finance-advice.ts'

describe('financial counselor context', () => {
  it('builds 10-to-9 spending cycles while excluding all transactions before October 7', () => {
    const context = buildFinancialAdviceContext([
      { transaction_date: '2026-10-16', amount: -40, manual_category: null, ai_category: 'saude', is_necessary: true, installment_number: null, total_installments: null },
      { transaction_date: '2026-10-06', amount: -20, manual_category: null, ai_category: 'alimentacao', is_necessary: null, installment_number: null, total_installments: null },
      { transaction_date: '2026-10-06', amount: -30, manual_category: null, ai_category: 'alimentacao', is_necessary: false, installment_number: 1, total_installments: 3 },
    ], [], [], '2026-10-17')

    expect(financialAdviceStartDate('2026-10-17')).toBe('2026-10-07')
    expect(context.cycles[0]).toMatchObject({ from: '2026-10-10', to: '2026-11-09', expensesByCategory: { Saúde: 40 }, classifiedExpenseTotal: 40, necessityAssessment: { necessaryExpenseAmount: 40, unnecessaryExpenseAmount: 0, assessedExpenseCount: 1 } })
    expect(context.cycles[1]).toMatchObject({ from: '2026-09-10', to: '2026-10-09', expensesByCategory: {}, classifiedExpenseTotal: 0, necessityAssessment: { necessaryExpenseAmount: 0, unnecessaryExpenseAmount: 0, assessedExpenseCount: 0 } })
    expect(context.financialBudgetTargets).toBeNull()
  })

  it('compares the recurring study and gym plan with completed occurrences over 28 days', () => {
    const context = buildFinancialAdviceContext([], [
      { id: 'gym-saturday', weekday: 6, category: 'gym', is_trackable: true, active: true },
      { id: 'study-monday', weekday: 1, category: 'study', is_trackable: true, active: true },
      { id: 'work', weekday: 1, category: 'commitment', is_trackable: false, active: true },
    ], [
      { routine_item_id: 'gym-saturday', local_date: '2026-10-17', completed_at: '2026-10-17T12:00:00Z' },
      { routine_item_id: 'study-monday', local_date: '2026-10-12', completed_at: '2026-10-12T12:00:00Z' },
    ], '2026-10-17')

    expect(context.routine).toEqual({
      plannedWeekly: { study: 1, gym: 1 },
      recent28Days: {
        from: '2026-09-20', to: '2026-10-17',
        study: { planned: 4, completed: 1 },
        gym: { planned: 4, completed: 1 },
      },
    })
  })
})
