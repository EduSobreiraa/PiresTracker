import type { SupabaseClient } from '@supabase/supabase-js'
import { categories, type Completion, type Database, type RoutineDraft, type RoutineItem, type StudyGoal, type StudyGoalDraft } from './types'
import { categoryIsTrackable, toggleCompletion } from './domain'
import { initialRoutine } from './routine'
import { isStudyGoal, studyPlan } from './studyPlan'

type LocalData = { items: RoutineItem[]; completions: Completion[]; studyGoals: StudyGoal[] }
const localKey = 'minha-rotina-v1'

function readLocal(): LocalData {
  const raw = localStorage.getItem(localKey)
  if (!raw) return { items: [], completions: [], studyGoals: [] }
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items) || !value.items.every(isRoutineItem) || !('completions' in value) || !Array.isArray(value.completions) || !value.completions.every(isCompletion)) {
    throw new Error('Os dados de demonstração estão inválidos. Limpe o armazenamento local para continuar.')
  }
  return { items: value.items, completions: value.completions, studyGoals: 'studyGoals' in value && Array.isArray(value.studyGoals) && value.studyGoals.every(isStudyGoal) ? value.studyGoals : [] }
}

function isRoutineItem(value: unknown): value is RoutineItem {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' && 'user_id' in value && (typeof value.user_id === 'string' || value.user_id === null) && 'weekday' in value && typeof value.weekday === 'number' && value.weekday >= 0 && value.weekday <= 6 && 'starts_at' in value && typeof value.starts_at === 'string' && 'ends_at' in value && typeof value.ends_at === 'string' && 'title' in value && typeof value.title === 'string' && 'category' in value && typeof value.category === 'string' && categories.some((category) => category === value.category) && 'is_trackable' in value && typeof value.is_trackable === 'boolean' && 'active' in value && typeof value.active === 'boolean'
}

function isCompletion(value: unknown): value is Completion {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' && 'user_id' in value && (typeof value.user_id === 'string' || value.user_id === null) && 'routine_item_id' in value && typeof value.routine_item_id === 'string' && 'local_date' in value && typeof value.local_date === 'string' && 'completed_at' in value && (typeof value.completed_at === 'string' || value.completed_at === null)
}

function writeLocal(data: LocalData): void {
  localStorage.setItem(localKey, JSON.stringify(data))
}

function failure(error: { message: string }): never {
  throw new Error(error.message || 'Não foi possível sincronizar com o Supabase.')
}

function requireUserId(userId: string | null): string {
  if (!userId) throw new Error('Sua sessão expirou. Entre novamente para sincronizar a rotina.')
  return userId
}

function parseRoutineItem(row: Database['public']['Tables']['routine_items']['Row']): RoutineItem {
  const category = categories.find((value) => value === row.category)
  if (!category || row.weekday < 0 || row.weekday > 6 || row.is_trackable !== categoryIsTrackable(category)) {
    throw new Error('Uma atividade recebida do Supabase tem dados inválidos.')
  }
  return { ...row, category }
}

function makeInitialItems(userId: string | null): RoutineItem[] {
  return initialRoutine.map((item) => ({ ...item, id: crypto.randomUUID(), user_id: userId, is_trackable: categoryIsTrackable(item.category), active: true }))
}

export function createDataAccess(client: SupabaseClient<Database> | null, userId: string | null) {
  return {
    async loadItems(): Promise<RoutineItem[]> {
      if (!client) {
        const local = readLocal()
        local.items = local.items.filter((item) => !/deslocamento|buscar namorada|deixar namorada|buscar colega/i.test(item.title))
        if (!local.items.length) {
          local.items = makeInitialItems(null)
        }
        writeLocal(local)
        return local.items.filter((item) => item.active)
      }
      const ownerId = requireUserId(userId)
      const { data, error } = await client.from('routine_items').select('*').eq('user_id', ownerId).order('starts_at')
      if (error) failure(error)
      const eligible = data.filter((item) => !/deslocamento|buscar namorada|deixar namorada|buscar colega/i.test(item.title))
      if (eligible.length) {
        const removed = data.filter((item) => !eligible.includes(item))
        if (removed.length) {
          const { error: archiveError } = await client.from('routine_items').update({ active: false }).in('id', removed.map(({ id }) => id)).eq('user_id', ownerId)
          if (archiveError) failure(archiveError)
        }
        return eligible.filter((item) => item.active).map(parseRoutineItem)
      }
      const seeds = initialRoutine.filter((item) => !/deslocamento|buscar namorada|deixar namorada|buscar colega/i.test(item.title)).map((item) => ({ ...item, user_id: ownerId, is_trackable: categoryIsTrackable(item.category), active: true }))
      const { data: seeded, error: seedError } = await client.from('routine_items').upsert(seeds, { onConflict: 'user_id,weekday,starts_at,title,category' }).select()
      if (seedError) failure(seedError)
      return seeded.map(parseRoutineItem)
    },
    async loadCompletions(start: string): Promise<Completion[]> {
      const end = new Date(`${start}T00:00:00Z`)
      end.setUTCDate(end.getUTCDate() + 6)
      const last = end.toISOString().slice(0, 10)
      if (!client) return readLocal().completions.filter((item) => item.local_date >= start && item.local_date <= last)
      const { data, error } = await client.from('completions').select('*').eq('user_id', requireUserId(userId)).gte('local_date', start).lte('local_date', last)
      if (error) failure(error)
      return data
    },
    async saveItem(draft: RoutineDraft, id?: string): Promise<RoutineItem> {
      const values = { ...draft, title: draft.title.trim(), is_trackable: categoryIsTrackable(draft.category), active: true }
      if (!client) {
        const data = readLocal()
        const existing = id && data.items.find((item) => item.id === id)
        const item: RoutineItem = { ...values, id: id ?? crypto.randomUUID(), user_id: null, ...(existing ? { active: existing.active } : {}) }
        writeLocal({ ...data, items: [...data.items.filter((entry) => entry.id !== item.id), item] })
        return item
      }
      if (id) {
        const { data, error } = await client.from('routine_items').update(values).eq('id', id).eq('user_id', requireUserId(userId)).select().single()
        if (error) failure(error)
        return parseRoutineItem(data)
      }
      const { data, error } = await client.from('routine_items').upsert({ ...values, user_id: requireUserId(userId) }, { onConflict: 'user_id,weekday,starts_at,title,category' }).select().single()
      if (error) failure(error)
      return parseRoutineItem(data)
    },
    async archiveItem(id: string): Promise<void> {
      if (!client) {
        const data = readLocal()
        writeLocal({ ...data, items: data.items.map((item) => item.id === id ? { ...item, active: false } : item) })
        return
      }
      const { error } = await client.from('routine_items').update({ active: false }).eq('id', id).eq('user_id', requireUserId(userId))
      if (error) failure(error)
    },
    async saveCompletion(item: RoutineItem, date: string, completed: boolean): Promise<Completion> {
      const values = { routine_item_id: item.id, user_id: userId, local_date: date, completed_at: completed ? new Date().toISOString() : null }
      if (!client) {
        const data = readLocal()
        const completions = toggleCompletion(data.completions, item, date, completed, userId)
        const completion = completions.find((entry) => entry.routine_item_id === item.id && entry.local_date === date)
        if (!completion) throw new Error('Não foi possível salvar a atividade.')
        writeLocal({ ...data, completions })
        return completion
      }
      const { data, error } = await client.from('completions').upsert({ ...values, user_id: requireUserId(userId) }, { onConflict: 'user_id,routine_item_id,local_date' }).select().single()
      if (error) failure(error)
      return data
    },
    async loadStudyGoals(): Promise<StudyGoal[]> {
      if (!client) {
        const data = readLocal()
        if (!data.studyGoals.length) data.studyGoals = studyPlan.map((goal) => ({ ...goal, id: crypto.randomUUID(), user_id: null, completed_at: null }))
        writeLocal(data)
        return data.studyGoals
      }
      const ownerId = requireUserId(userId)
      const { data, error } = await client.from('study_goals').select('*').eq('user_id', ownerId).order('week_start').order('track')
      if (error) failure(error)
      if (data.length) return data
      const { error: seedError } = await client.from('study_goals').upsert(studyPlan.map((goal) => ({ ...goal, user_id: ownerId, completed_at: null })), { onConflict: 'user_id,week_start,track,title', ignoreDuplicates: true })
      if (seedError) failure(seedError)
      const { data: allGoals, error: loadError } = await client.from('study_goals').select('*').eq('user_id', ownerId).order('week_start').order('track')
      if (loadError) failure(loadError)
      return allGoals
    },
    async saveStudyGoal(draft: StudyGoalDraft, id?: string): Promise<StudyGoal> {
      const values = { ...draft, title: draft.title.trim(), description: draft.description?.trim() || null }
      if (!client) {
        const local = readLocal()
        const old = id ? local.studyGoals.find((goal) => goal.id === id) : undefined
        const saved = { ...values, id: id ?? crypto.randomUUID(), user_id: null, completed_at: old?.completed_at ?? null }
        writeLocal({ ...local, studyGoals: [...local.studyGoals.filter((goal) => goal.id !== saved.id), saved] })
        return saved
      }
      const ownerId = requireUserId(userId)
      const query = id
        ? client.from('study_goals').update(values).eq('id', id).eq('user_id', ownerId)
        : client.from('study_goals').insert({ ...values, user_id: ownerId })
      const { data, error } = await query.select().single()
      if (error) failure(error)
      return data
    },
    async completeStudyGoal(id: string, completed: boolean): Promise<StudyGoal> {
      if (!client) {
        const local = readLocal()
        const goal = local.studyGoals.find((entry) => entry.id === id)
        if (!goal) throw new Error('Objetivo não encontrado.')
        const saved = { ...goal, completed_at: completed ? new Date().toISOString() : null }
        writeLocal({ ...local, studyGoals: local.studyGoals.map((entry) => entry.id === id ? saved : entry) })
        return saved
      }
      const { data, error } = await client.from('study_goals').update({ completed_at: completed ? new Date().toISOString() : null }).eq('id', id).eq('user_id', requireUserId(userId)).select().single()
      if (error) failure(error)
      return data
    },
    async deleteStudyGoal(id: string): Promise<void> {
      if (!client) {
        const local = readLocal()
        writeLocal({ ...local, studyGoals: local.studyGoals.filter((goal) => goal.id !== id) })
        return
      }
      const { error } = await client.from('study_goals').delete().eq('id', id).eq('user_id', requireUserId(userId))
      if (error) failure(error)
    },
  }
}
