import { beforeEach, describe, expect, it } from 'vitest'
import { createDataAccess } from './data'
import { dayItems, weeklyProgress } from './domain'

const values = new Map<string, string>()

beforeEach(() => {
  values.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    },
  })
})

describe('local demonstration storage', () => {
  it('loads the confirmed weekly schedule once and shows the planned checklist totals', async () => {
    const firstOpen = createDataAccess(null, null)
    const items = await firstOpen.loadItems()

    expect(dayItems(items, '2026-10-12').map(({ starts_at, title }) => [starts_at, title])).toEqual([
      ['08:30', 'Academia'],
      ['10:00', 'Cálculo I'],
      ['12:00', 'Almoço e pausa'],
      ['14:00', 'Trabalho'],
      ['19:00', 'AWS AI Practitioner'],
    ])
    expect(weeklyProgress(items, [], '2026-10-12')).toEqual({ gymDone: 0, gymPlanned: 3, studyDone: 0, studyPlanned: 11 })
    expect(await createDataAccess(null, null).loadItems()).toHaveLength(items.length)
    expect(dayItems(items, '2026-10-13').find(({ title }) => title.startsWith('Deslocamento'))?.is_trackable).toBe(false)
  })

  it('edits recurring fields and removes an item without erasing its dated history', async () => {
    const data = createDataAccess(null, null)
    const gym = await data.saveItem({ weekday: 1, starts_at: '08:00', ends_at: '09:00', title: 'Academia extra', category: 'gym' })
    await data.saveCompletion(gym, '2026-10-12', true)
    await data.saveItem({ weekday: 2, starts_at: '07:30', ends_at: '08:30', title: 'Corrida', category: 'study' }, gym.id)

    const edited = await data.loadItems()
    expect(edited).toEqual([{ ...gym, weekday: 2, starts_at: '07:30', ends_at: '08:30', title: 'Corrida', category: 'study', is_trackable: true }])
    expect(weeklyProgress(edited, [], '2026-10-12')).toEqual({ gymDone: 0, gymPlanned: 0, studyDone: 0, studyPlanned: 1 })
    await data.archiveItem(gym.id)
    await data.archiveItem(gym.id)
    expect(await data.loadItems()).toEqual([])
    expect((await data.loadCompletions('2026-10-12')).map(({ local_date }) => local_date)).toEqual(['2026-10-12'])
    expect(weeklyProgress([], await data.loadCompletions('2026-10-12'), '2026-10-12')).toEqual({ gymDone: 0, gymPlanned: 0, studyDone: 0, studyPlanned: 0 })
  })

  it('keeps routine items and one completion per activity date after reload', async () => {
    const firstSession = createDataAccess(null, null)
    const item = await firstSession.saveItem({ weekday: 1, starts_at: '08:30', ends_at: '09:30', title: 'Academia', category: 'gym' })
    await firstSession.saveCompletion(item, '2026-10-12', true)
    await firstSession.saveCompletion(item, '2026-10-12', true)
    await firstSession.saveCompletion(item, '2026-10-19', true)

    const reloaded = createDataAccess(null, null)
    const priorWeek = await reloaded.loadCompletions('2026-10-12')
    const completions = await reloaded.loadCompletions('2026-10-19')
    expect(await reloaded.loadItems()).toHaveLength(1)
    expect(priorWeek).toHaveLength(1)
    expect(priorWeek[0].local_date).toBe('2026-10-12')
    expect(completions).toHaveLength(1)
    expect(completions[0].local_date).toBe('2026-10-19')
    expect(completions[0].completed_at).not.toBeNull()
  })

  it('records unchecking against the selected date without erasing the prior week', async () => {
    const data = createDataAccess(null, null)
    const item = await data.saveItem({ weekday: 1, starts_at: '13:00', ends_at: '13:40', title: 'Estudos', category: 'study' })
    await data.saveCompletion(item, '2026-10-12', true)
    await data.saveCompletion(item, '2026-10-19', true)
    await data.saveCompletion(item, '2026-10-19', false)

    expect((await data.loadCompletions('2026-10-12')).map(({ completed_at }) => completed_at !== null)).toEqual([true])
    expect((await data.loadCompletions('2026-10-19')).map(({ completed_at }) => completed_at !== null)).toEqual([false])
  })
})
