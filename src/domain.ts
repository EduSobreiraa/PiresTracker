import type { Category, Completion, RoutineDraft, RoutineItem } from './types'

export const weekdayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const weekdayShort = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export function bahiaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}

export function weekStart(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return addDays(date, -((weekday + 6) % 7))
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...options }).format(new Date(`${date}T12:00:00Z`))
}

export function dayItems(items: RoutineItem[], date: string): RoutineItem[] {
  return items.filter((item) => item.active && item.weekday === weekdayOf(date)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
}

export function currentOrNextActivity(items: RoutineItem[], date: string, now = new Date()) {
  if (date !== bahiaToday(now)) return null
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bahia', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now).split(':').map(Number)
  const minuteOfDay = parts[0] * 60 + parts[1]
  const schedule = dayItems(items, date)
  const current = schedule.find((item) => minuteOfDay >= minutes(item.starts_at) && minuteOfDay < minutes(item.ends_at))
  if (current) return { item: current, status: 'current' as const }
  const next = schedule.find((item) => minutes(item.starts_at) > minuteOfDay)
  return next ? { item: next, status: 'next' as const } : null
}

function minutes(time: string): number {
  const [hours, minute] = time.split(':').map(Number)
  return hours * 60 + minute
}

export function weeklyProgress(items: RoutineItem[], completions: Completion[], start: string) {
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const done = new Set(completions.filter((item) => item.completed_at && weekDates.includes(item.local_date)).map((item) => `${item.routine_item_id}:${item.local_date}`))
  const count = (category: Category) => weekDates.reduce((sum, date) => sum + items.filter((item) => item.active && item.category === category && item.weekday === weekdayOf(date) && done.has(`${item.id}:${date}`)).length, 0)
  const plan = (category: Category) => weekDates.reduce((sum, date) => sum + items.filter((item) => item.active && item.category === category && item.weekday === weekdayOf(date)).length, 0)
  return { gymDone: count('gym'), gymPlanned: plan('gym'), studyDone: count('study'), studyPlanned: plan('study') }
}

export function categoryIsTrackable(category: Category): boolean {
  return category !== 'commitment'
}

export function isValidDraft(draft: RoutineDraft): boolean {
  const validTime = (time: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
  return draft.title.trim().length > 0 && validTime(draft.starts_at) && validTime(draft.ends_at) && draft.ends_at > draft.starts_at && draft.weekday >= 0 && draft.weekday <= 6
}

export function toggleCompletion(completions: Completion[], item: RoutineItem, date: string, completed: boolean, userId: string | null): Completion[] {
  const id = `${item.id}:${date}`
  const existing = completions.find((completion) => `${completion.routine_item_id}:${completion.local_date}` === id)
  const updated: Completion = { id: existing?.id ?? id, user_id: userId, routine_item_id: item.id, local_date: date, completed_at: completed ? new Date().toISOString() : null }
  return [...completions.filter((completion) => `${completion.routine_item_id}:${completion.local_date}` !== id), updated]
}
