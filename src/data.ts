import type { SupabaseClient } from '@supabase/supabase-js'
import { categories, type Completion, type Database, type FinancialAccount, type FinancialBill, type FinancialCategory, type FinancialConnection, type FinancialSyncExecution, type FinancialTransaction, type LifeEvent, type LifeEventDraft, type Project, type ProjectDraft, type ProjectStage, type ProjectStageDraft, type ProjectTask, type ProjectTaskDraft, type ProjectTree, type RoutineDraft, type RoutineItem, type StudyGoal } from './types'
import { categoryIsTrackable, toggleCompletion } from './domain'
import { initialRoutine } from './routine'
import { isStudyGoal } from './studyPlan'
import { awsProjectSeed, isProject, isProjectStage, isProjectTask, seedLocalAwsProject } from './projectPlan'
import { financialCleanupCutoff } from './finance-history'

type LocalData = { items: RoutineItem[]; completions: Completion[]; studyGoals: StudyGoal[]; projects: Project[]; projectStages: ProjectStage[]; projectTasks: ProjectTask[]; lifeEvents: LifeEvent[]; projectSeeded: boolean }
const localKey = 'minha-rotina-v1'

function readLocal(): LocalData {
  const raw = localStorage.getItem(localKey)
  if (!raw) return { items: [], completions: [], studyGoals: [], projects: [], projectStages: [], projectTasks: [], lifeEvents: [], projectSeeded: false }
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items) || !value.items.every(isRoutineItem) || !('completions' in value) || !Array.isArray(value.completions) || !value.completions.every(isCompletion)) {
    throw new Error('Os dados de demonstração estão inválidos. Limpe o armazenamento local para continuar.')
  }
  const savedGoals = 'studyGoals' in value && Array.isArray(value.studyGoals) && value.studyGoals.every(isStudyGoal) ? value.studyGoals : []
  const projects = 'projects' in value && Array.isArray(value.projects) && value.projects.every(isProject) ? value.projects : []
  const projectStages = 'projectStages' in value && Array.isArray(value.projectStages) && value.projectStages.every(isProjectStage) ? value.projectStages : []
  const projectTasks = 'projectTasks' in value && Array.isArray(value.projectTasks) && value.projectTasks.every(isProjectTask) ? value.projectTasks : []
  const lifeEvents = 'lifeEvents' in value && Array.isArray(value.lifeEvents) && value.lifeEvents.every(isLifeEvent) ? value.lifeEvents : []
  return { items: value.items, completions: value.completions, studyGoals: savedGoals.filter((goal) => goal.track === 'aws').map((goal) => ({ ...goal, parent_goal_id: goal.parent_goal_id ?? null, optional: goal.optional ?? false, waivable: goal.waivable ?? false, waived_at: goal.waived_at ?? null, archived_at: goal.archived_at ?? null })), projects, projectStages, projectTasks, lifeEvents, projectSeeded: 'projectSeeded' in value && value.projectSeeded === true }
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isLifeEvent(value: unknown): value is LifeEvent {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' && 'user_id' in value && (typeof value.user_id === 'string' || value.user_id === null) && 'title' in value && typeof value.title === 'string' && 'event_date' in value && typeof value.event_date === 'string' && isDateOnly(value.event_date) && 'description' in value && (typeof value.description === 'string' || value.description === null) && 'created_at' in value && typeof value.created_at === 'string' && 'updated_at' in value && typeof value.updated_at === 'string'
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

export type FinancialWorkspace = {
  connections: FinancialConnection[]
  accounts: FinancialAccount[]
  transactions: FinancialTransaction[]
  bills: FinancialBill[]
  syncExecutions: FinancialSyncExecution[]
}

export type FinancialSyncResult = { accountsCount: number; transactionsCount: number; billsCount: number; inheritedInstallmentsCount: number; classificationError: string | null }

function parseFinancialSyncResult(value: unknown): FinancialSyncResult {
  if (typeof value !== 'object' || value === null || !('status' in value) || value.status !== 'SUCCEEDED' || !('accountsCount' in value) || typeof value.accountsCount !== 'number' || !('transactionsCount' in value) || typeof value.transactionsCount !== 'number' || !('billsCount' in value) || typeof value.billsCount !== 'number') {
    throw new Error('A sincronização terminou sem um resumo válido.')
  }
  const classification = 'classification' in value && typeof value.classification === 'object' && value.classification !== null ? value.classification : null
  return {
    accountsCount: value.accountsCount,
    transactionsCount: value.transactionsCount,
    billsCount: value.billsCount,
    inheritedInstallmentsCount: classification && 'inherited' in classification && typeof classification.inherited === 'number' ? classification.inherited : 0,
    classificationError: classification && 'error' in classification && typeof classification.error === 'string' ? classification.error : null,
  }
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
    async loadLifeEvents(): Promise<LifeEvent[]> {
      if (!client) return readLocal().lifeEvents.sort((a, b) => a.event_date.localeCompare(b.event_date))
      const { data, error } = await client.from('life_events').select('*').eq('user_id', requireUserId(userId)).order('event_date').order('created_at')
      if (error) failure(error)
      return data
    },
    async loadFinancialWorkspace(): Promise<FinancialWorkspace> {
      const ownerId = requireUserId(userId)
      if (!client) throw new Error('Entre em uma sessão Supabase para consultar seus dados financeiros.')
      const [connections, accounts, transactions, bills, syncExecutions] = await Promise.all([
        client.from('financial_connections').select('*').eq('user_id', ownerId).order('institution_name'),
        client.from('financial_accounts').select('*').eq('user_id', ownerId).order('name'),
        // shortcut: only the latest 1000 rows are loaded; paginate when the account history exceeds this limit.
        client.from('financial_transactions').select('*').eq('user_id', ownerId).gte('transaction_date', financialCleanupCutoff).order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(1000),
        client.from('financial_bills').select('*').eq('user_id', ownerId).order('due_date', { ascending: false }).limit(50),
        client.from('financial_sync_executions').select('*').eq('user_id', ownerId).order('started_at', { ascending: false }).limit(20),
      ])
      if (connections.error) failure(connections.error)
      if (accounts.error) failure(accounts.error)
      if (transactions.error) failure(transactions.error)
      if (bills.error) failure(bills.error)
      if (syncExecutions.error) failure(syncExecutions.error)
      return { connections: connections.data, accounts: accounts.data, transactions: transactions.data, bills: bills.data, syncExecutions: syncExecutions.data }
    },
    async syncFinancialConnection(connectionId: string): Promise<FinancialSyncResult> {
      requireUserId(userId)
      if (!client) throw new Error('Conecte o Supabase para sincronizar uma instituição.')
      const { data, error } = await client.functions.invoke<unknown>('finance-sync', { body: { connectionId } })
      if (error) throw new Error(error.message || 'Não foi possível sincronizar esta instituição.')
      return parseFinancialSyncResult(data)
    },
    async saveFinancialCategory(transactionId: string, category: FinancialCategory | null): Promise<void> {
      if (!client) throw new Error('Entre em uma sessão Supabase para editar a categoria.')
      const { data, error } = await client.functions.invoke<unknown>('finance-categorize', { body: { action: 'set-manual-category', transactionId, category } })
      if (error) failure(error)
      if (typeof data !== 'object' || data === null || !('status' in data) || data.status !== 'SUCCEEDED') throw new Error('Não foi possível salvar a categoria da movimentação.')
    },
    async saveFinancialNecessity(transactionId: string, isNecessary: boolean | null): Promise<void> {
      if (!client) throw new Error('Entre em uma sessão Supabase para editar a avaliação da compra.')
      const { data, error } = await client.functions.invoke<unknown>('finance-categorize', { body: { action: 'set-manual-necessity', transactionId, isNecessary } })
      if (error) failure(error)
      if (typeof data !== 'object' || data === null || !('status' in data) || data.status !== 'SUCCEEDED') throw new Error('Não foi possível salvar a avaliação da compra.')
    },
    async saveLifeEvent(draft: LifeEventDraft, id?: string): Promise<LifeEvent> {
      const values = { title: draft.title.trim(), event_date: draft.event_date, description: draft.description?.trim() || null }
      if (!values.title || values.title.length > 120 || !isDateOnly(values.event_date) || (values.description?.length ?? 0) > 1000) throw new Error('Confira o título, a data e a descrição do evento.')
      if (!client) {
        const local = readLocal()
        const existing = id ? local.lifeEvents.find((event) => event.id === id) : undefined
        const now = new Date().toISOString()
        const saved: LifeEvent = { ...values, id: id ?? crypto.randomUUID(), user_id: null, created_at: existing?.created_at ?? now, updated_at: now }
        writeLocal({ ...local, lifeEvents: [...local.lifeEvents.filter((event) => event.id !== saved.id), saved] })
        return saved
      }
      const ownerId = requireUserId(userId)
      const query = id ? client.from('life_events').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', ownerId) : client.from('life_events').insert({ ...values, user_id: ownerId })
      const { data, error } = await query.select().single()
      if (error) failure(error)
      return data
    },
    async deleteLifeEvent(id: string): Promise<void> {
      if (!client) {
        const local = readLocal()
        writeLocal({ ...local, lifeEvents: local.lifeEvents.filter((event) => event.id !== id) })
        return
      }
      const { error } = await client.from('life_events').delete().eq('id', id).eq('user_id', requireUserId(userId))
      if (error) failure(error)
    },
    async loadProjects(): Promise<ProjectTree> {
      if (!client) {
        const local = readLocal()
        if (!local.projectSeeded) {
          if (!local.projects.some((project) => project.seed_key === awsProjectSeed.key)) {
            const seeded = seedLocalAwsProject(local.studyGoals)
            local.projects.push(seeded.project)
            local.projectStages.push(...seeded.stages)
            local.projectTasks.push(...seeded.tasks)
          }
          local.studyGoals = local.studyGoals.filter((goal) => goal.track === 'aws')
          local.projectSeeded = true
          writeLocal(local)
        }
        return { projects: local.projects, stages: local.projectStages, tasks: local.projectTasks }
      }
      const ownerId = requireUserId(userId)
      const { data: projects, error: projectsError } = await client.from('projects').select('*').eq('user_id', ownerId).order('created_at')
      if (projectsError) failure(projectsError)
      if (!projects.length) return { projects: [], stages: [], tasks: [] }
      const projectIds = projects.map(({ id }) => id)
      const { data: stages, error: stagesError } = await client.from('project_stages').select('*').eq('user_id', ownerId).in('project_id', projectIds).order('position')
      if (stagesError) failure(stagesError)
      const stageIds = stages.map(({ id }) => id)
      const { data: tasks, error: tasksError } = stageIds.length
        ? await client.from('project_tasks').select('*').eq('user_id', ownerId).in('stage_id', stageIds).order('position')
        : { data: [], error: null }
      if (tasksError) failure(tasksError)
      return { projects, stages, tasks }
    },
    async saveProject(draft: ProjectDraft, id?: string): Promise<Project> {
      const values = { name: draft.name.trim(), description: draft.description?.trim() || null }
      if (!client) {
        const local = readLocal()
        const old = id ? local.projects.find((project) => project.id === id) : undefined
        const saved: Project = { ...values, id: id ?? crypto.randomUUID(), user_id: null, seed_key: old?.seed_key ?? null, created_at: old?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString() }
        writeLocal({ ...local, projects: [...local.projects.filter((project) => project.id !== saved.id), saved] })
        return saved
      }
      const ownerId = requireUserId(userId)
      const query = id ? client.from('projects').update(values).eq('id', id).eq('user_id', ownerId) : client.from('projects').insert({ ...values, seed_key: null, user_id: ownerId })
      const { data, error } = await query.select().single()
      if (error) failure(error)
      return data
    },
    async deleteProject(id: string): Promise<void> {
      if (!client) {
        const local = readLocal()
        const stageIds = new Set(local.projectStages.filter((stage) => stage.project_id === id).map(({ id: stageId }) => stageId))
        writeLocal({ ...local, projects: local.projects.filter((project) => project.id !== id), projectStages: local.projectStages.filter((stage) => stage.project_id !== id), projectTasks: local.projectTasks.filter((task) => task.project_id !== id && !stageIds.has(task.stage_id)) })
        return
      }
      const { error } = await client.from('projects').delete().eq('id', id).eq('user_id', requireUserId(userId))
      if (error) failure(error)
    },
    async saveProjectStage(projectId: string, draft: ProjectStageDraft, id?: string): Promise<ProjectStage> {
      const values = { title: draft.title.trim(), description: draft.description?.trim() || null, position: draft.position }
      if (!client) {
        const local = readLocal()
        const old = id ? local.projectStages.find((stage) => stage.id === id) : undefined
        const saved: ProjectStage = { ...values, id: id ?? crypto.randomUUID(), project_id: projectId, user_id: null, seed_key: old?.seed_key ?? null, completed_at: old?.completed_at ?? null, created_at: old?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString() }
        writeLocal({ ...local, projectStages: [...local.projectStages.filter((stage) => stage.id !== saved.id), saved] })
        return saved
      }
      const ownerId = requireUserId(userId)
      const query = id ? client.from('project_stages').update(values).eq('id', id).eq('project_id', projectId).eq('user_id', ownerId) : client.from('project_stages').insert({ ...values, project_id: projectId, user_id: ownerId, seed_key: null })
      const { data, error } = await query.select().single()
      if (error) failure(error)
      return data
    },
    async completeProjectStage(id: string, completed: boolean): Promise<ProjectStage> {
      const values = { completed_at: completed ? new Date().toISOString() : null }
      if (!client) {
        const local = readLocal()
        const saved = local.projectStages.find((stage) => stage.id === id)
        if (!saved) throw new Error('Etapa não encontrada.')
        const updated = { ...saved, ...values, updated_at: new Date().toISOString() }
        writeLocal({ ...local, projectStages: local.projectStages.map((stage) => stage.id === id ? updated : stage) })
        return updated
      }
      const { data, error } = await client.from('project_stages').update(values).eq('id', id).eq('user_id', requireUserId(userId)).select().single()
      if (error) failure(error)
      return data
    },
    async deleteProjectStage(id: string): Promise<void> {
      if (!client) {
        const local = readLocal()
        writeLocal({ ...local, projectStages: local.projectStages.filter((stage) => stage.id !== id), projectTasks: local.projectTasks.filter((task) => task.stage_id !== id) })
        return
      }
      const { error } = await client.from('project_stages').delete().eq('id', id).eq('user_id', requireUserId(userId))
      if (error) failure(error)
    },
    async saveProjectTask(projectId: string, stageId: string, draft: ProjectTaskDraft, id?: string): Promise<ProjectTask> {
      const values = { title: draft.title.trim(), description: draft.description?.trim() || null, planned_week: draft.planned_week || null, position: draft.position, optional: draft.optional, waivable: draft.waivable }
      if (!client) {
        const local = readLocal()
        const old = id ? local.projectTasks.find((task) => task.id === id) : undefined
        const saved: ProjectTask = { ...values, id: id ?? crypto.randomUUID(), project_id: projectId, stage_id: stageId, user_id: null, seed_key: old?.seed_key ?? null, completed_at: old?.completed_at ?? null, waived_at: old?.waived_at ?? null, created_at: old?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString() }
        writeLocal({ ...local, projectTasks: [...local.projectTasks.filter((task) => task.id !== saved.id), saved] })
        return saved
      }
      const ownerId = requireUserId(userId)
      const query = id ? client.from('project_tasks').update(values).eq('id', id).eq('project_id', projectId).eq('stage_id', stageId).eq('user_id', ownerId) : client.from('project_tasks').insert({ ...values, project_id: projectId, stage_id: stageId, user_id: ownerId, seed_key: null })
      const { data, error } = await query.select().single()
      if (error) failure(error)
      return data
    },
    async setProjectTaskState(id: string, state: 'pending' | 'completed' | 'waived'): Promise<ProjectTask> {
      if (!client) {
        const local = readLocal()
        const task = local.projectTasks.find((entry) => entry.id === id)
        if (!task || (state === 'waived' && !task.waivable)) throw new Error('Esta tarefa não pode ser dispensada.')
        const updated = { ...task, completed_at: state === 'completed' ? new Date().toISOString() : null, waived_at: state === 'waived' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }
        writeLocal({ ...local, projectTasks: local.projectTasks.map((entry) => entry.id === id ? updated : entry) })
        return updated
      }
      const ownerId = requireUserId(userId)
      let query = client.from('project_tasks').update({ completed_at: state === 'completed' ? new Date().toISOString() : null, waived_at: state === 'waived' ? new Date().toISOString() : null }).eq('id', id).eq('user_id', ownerId)
      if (state === 'waived') query = query.eq('waivable', true)
      const { data, error } = await query.select().single()
      if (error) failure(error)
      return data
    },
    async deleteProjectTask(id: string): Promise<void> {
      if (!client) {
        const local = readLocal()
        writeLocal({ ...local, projectTasks: local.projectTasks.filter((task) => task.id !== id) })
        return
      }
      const { error } = await client.from('project_tasks').delete().eq('id', id).eq('user_id', requireUserId(userId))
      if (error) failure(error)
    },
  }
}
