import { describe, expect, it } from 'vitest'
import { hasInstallmentIdentity, inheritedInstallmentClassification, inheritedInstallmentNecessity } from './installment-classification.ts'

describe('installment category reuse', () => {
  it('keeps a manual correction across installments, ahead of prior AI suggestions', () => {
    expect(inheritedInstallmentClassification([
      { manual_category: null, ai_category: 'alimentacao' },
      { manual_category: 'saude', ai_category: 'outros' },
    ])).toEqual({ category: 'saude', manual: true })
  })

  it('reuses the prior AI category when there is no manual correction', () => {
    expect(inheritedInstallmentClassification([{ manual_category: null, ai_category: 'transporte' }]))
      .toEqual({ category: 'transporte', manual: false })
  })

  it('does not assign a category when no sibling has one', () => {
    expect(inheritedInstallmentClassification([{ manual_category: null, ai_category: null }])).toBeNull()
  })

  it('reuses a user necessity assessment across installments and preserves false', () => {
    expect(inheritedInstallmentNecessity([{ is_necessary: null }, { is_necessary: false }])).toBe(false)
    expect(inheritedInstallmentNecessity([{ is_necessary: null }])).toBeNull()
  })

  it('requires enough Pluggy metadata to identify the same installment purchase', () => {
    const transaction = { account_id: 'account', amount: -25, merchant_name: ' Store ', purchase_date: '2026-10-01', installment_number: 1, total_installments: 4 }
    expect(hasInstallmentIdentity(transaction)).toBe(true)
    expect(hasInstallmentIdentity({ ...transaction, total_installments: 1 })).toBe(false)
    expect(hasInstallmentIdentity({ ...transaction, merchant_name: null })).toBe(false)
  })
})
