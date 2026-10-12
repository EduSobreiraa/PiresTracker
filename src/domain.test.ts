import { describe, expect, it } from 'vitest'
import { addDays, bahiaToday, currentOrNextActivity, isValidDraft, toggleCompletion, weeklyProgress, weekStart } from './domain'
import type { Completion, RoutineDraft, RoutineItem } from './types'

const item = (id: string, weekday: number, category: RoutineItem['category']): RoutineItem => ({ id, user_id: 'user', weekday, starts_at: '08:00', ends_at: '09:00', title: id, category, is_trackable: category !== 'commitment', active: true })

describe('week dates in Bahia', () => {
  it('uses the Bahia calendar date around midnight', () => {
    expect(bahiaToday(new Date('2026-10-12T02:59:00Z'))).toBe('2026-10-11')
    expect(bahiaToday(new Date('2026-10-12T03:00:00Z'))).toBe('2026-10-12')
  })

  it('finds Monday and moves across month and year boundaries', () => {
    expect(weekStart('2026-01-01')).toBe('2025-12-29')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
  })
})

describe('weekly checklist totals', () => {
  it('counts completed occurrences only in their matching week and date', () => {
    const gym = item('gym', 1, 'gym')
    const study = item('study', 1, 'study')
    const appointment = item('appointment', 1, 'commitment')
    const completions: Completion[] = [
      { id: '1', user_id: 'user', routine_item_id: gym.id, local_date: '2026-10-05', completed_at: '2026-10-05T12:00:00Z' },
      { id: '2', user_id: 'user', routine_item_id: study.id, local_date: '2026-10-12', completed_at: '2026-10-12T12:00:00Z' },
      { id: '3', user_id: 'user', routine_item_id: appointment.id, local_date: '2026-10-12', completed_at: '2026-10-12T12:00:00Z' },
    ]
    expect(weeklyProgress([gym, study, appointment], completions, '2026-10-12')).toEqual({ gymDone: 0, gymPlanned: 1, studyDone: 1, studyPlanned: 1 })
  })

  it('sets weekly targets from active scheduled items after changes', () => {
    const mondayGym = item('gym-1', 1, 'gym')
    const tuesdayGym = item('gym-2', 2, 'gym')
    const mondayStudy = item('study', 1, 'study')
    const removedGym = { ...item('removed-gym', 6, 'gym'), active: false }
    const completions: Completion[] = [{ id: '1', user_id: 'user', routine_item_id: mondayGym.id, local_date: '2026-10-12', completed_at: '2026-10-12T12:00:00Z' }]

    expect(weeklyProgress([mondayGym, tuesdayGym, mondayStudy, removedGym], completions, '2026-10-12')).toEqual({ gymDone: 1, gymPlanned: 2, studyDone: 0, studyPlanned: 1 })
  })

  it('keeps a Sunday completion separate from the next Sunday occurrence', () => {
    const study = item('calculo', 0, 'study')
    const completedSunday: Completion[] = [{ id: '1', user_id: 'user', routine_item_id: study.id, local_date: '2026-10-11', completed_at: '2026-10-11T12:00:00Z' }]

    expect(weeklyProgress([study], completedSunday, '2026-10-05').studyDone).toBe(1)
    expect(weeklyProgress([study], completedSunday, '2026-10-12').studyDone).toBe(0)
    expect(weeklyProgress([study], completedSunday, '2026-10-12').studyPlanned).toBe(1)
  })
})

describe('current day highlight', () => {
  const schedule = [
    { ...item('work', 1, 'commitment'), starts_at: '14:00', ends_at: '18:00' },
    { ...item('study', 1, 'study'), starts_at: '19:00', ends_at: '20:30' },
  ]

  it('marks the current activity, then the next one at its end time in Bahia', () => {
    const current = currentOrNextActivity(schedule, '2026-10-12', new Date('2026-10-12T17:30:00Z'))
    const next = currentOrNextActivity(schedule, '2026-10-12', new Date('2026-10-12T21:00:00Z'))

    expect(current && { id: current.item.id, status: current.status }).toEqual({ id: 'work', status: 'current' })
    expect(next && { id: next.item.id, status: next.status }).toEqual({ id: 'study', status: 'next' })
    expect(currentOrNextActivity(schedule, '2026-10-19', new Date('2026-10-12T17:30:00Z'))).toBeNull()
  })
})

describe('activity validation and completion writes', () => {
  it('requires a valid time range and a non-empty activity name', () => {
    const draft: RoutineDraft = { weekday: 1, starts_at: '08:00', ends_at: '09:00', title: 'Leitura', category: 'study' }
    expect(isValidDraft(draft)).toBe(true)
    expect(isValidDraft({ ...draft, ends_at: '08:00' })).toBe(false)
    expect(isValidDraft({ ...draft, title: ' ' })).toBe(false)
  })

  it('stores one completion per activity and date when toggled repeatedly', () => {
    const gym = item('gym', 1, 'gym')
    const first = toggleCompletion([], gym, '2026-10-12', true, 'user')
    const repeated = toggleCompletion(first, gym, '2026-10-12', true, 'user')
    const nextWeek = toggleCompletion(repeated, gym, '2026-10-19', true, 'user')
    expect(nextWeek).toHaveLength(2)
    expect(nextWeek.map((entry) => entry.local_date)).toEqual(['2026-10-12', '2026-10-19'])
  })
})
