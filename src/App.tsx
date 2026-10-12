import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import AuthScreen, { Mark } from './AuthScreen'
import { bahiaToday, weekStart } from './domain'
import { createDataAccess } from './data'
import { configurationError, supabase } from './supabase'
import type { Completion, ProjectDraft, ProjectStageDraft, ProjectTaskDraft, ProjectTree, RoutineDraft, RoutineItem } from './types'

const Projects = lazy(() => import('./Projects'))
const RoutineView = lazy(() => import('./RoutineView'))

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [authError, setAuthError] = useState('')
  const [selectedDate, setSelectedDate] = useState(bahiaToday())
  const [items, setItems] = useState<RoutineItem[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogItem, setDialogItem] = useState<RoutineItem | null | undefined>(undefined)
  const [clockNow, setClockNow] = useState(() => new Date())
  const [section, setSection] = useState<'routine' | 'projects'>('routine')
  const [projectTree, setProjectTree] = useState<ProjectTree>({ projects: [], stages: [], tasks: [] })
  const [projectLoading, setProjectLoading] = useState(false)
  const [projectError, setProjectError] = useState('')

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setAuthError(sessionError.message)
      setSession(data.session)
      setAuthReady(true)
    }).catch((cause: unknown) => {
      if (active) { setAuthError(cause instanceof Error ? cause.message : 'Não foi possível verificar a sessão.'); setAuthReady(true) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, value) => { setSession(value); setAuthReady(true) })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const userId = session?.user.id ?? null
  const dataAccess = useMemo(() => createDataAccess(supabase, userId), [userId])
  const startOfWeek = weekStart(selectedDate)
  useEffect(() => {
    let active = true
    async function refresh() {
      setLoading(true)
      setError('')
      try {
        const [loadedItems, loadedCompletions] = await Promise.all([dataAccess.loadItems(), dataAccess.loadCompletions(startOfWeek)])
        if (!active) return
        setItems(loadedItems)
        setCompletions(loadedCompletions)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar sua rotina.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void refresh()
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => { active = false; window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  }, [dataAccess, startOfWeek])

  useEffect(() => {
    if (section !== 'projects') return
    let active = true
    setProjectLoading(true)
    setProjectError('')
    dataAccess.loadProjects().then((tree) => { if (active) setProjectTree(tree) }).catch((cause: unknown) => { if (active) setProjectError(cause instanceof Error ? cause.message : 'Não foi possível carregar os projetos.') }).finally(() => { if (active) setProjectLoading(false) })
    return () => { active = false }
  }, [dataAccess, section])

  async function refreshProjects() {
    setProjectTree(await dataAccess.loadProjects())
  }

  async function projectMutation(action: () => Promise<unknown>, fallback: string) {
    try { await action(); await refreshProjects(); setProjectError('') }
    catch (cause) { setProjectError(cause instanceof Error ? cause.message : fallback); throw cause }
  }

  const projectActions = {
    onSaveProject: (draft: ProjectDraft, id?: string) => projectMutation(() => dataAccess.saveProject(draft, id), 'Não foi possível salvar o projeto.'),
    onDeleteProject: (id: string) => projectMutation(() => dataAccess.deleteProject(id), 'Não foi possível excluir o projeto.'),
    onSaveStage: (projectId: string, draft: ProjectStageDraft, id?: string) => projectMutation(() => dataAccess.saveProjectStage(projectId, draft, id), 'Não foi possível salvar a etapa.'),
    onCompleteStage: (id: string, completed: boolean) => projectMutation(() => dataAccess.completeProjectStage(id, completed), 'Não foi possível atualizar a etapa.'),
    onDeleteStage: (id: string) => projectMutation(() => dataAccess.deleteProjectStage(id), 'Não foi possível excluir a etapa.'),
    onSaveTask: (projectId: string, stageId: string, draft: ProjectTaskDraft, id?: string) => projectMutation(() => dataAccess.saveProjectTask(projectId, stageId, draft, id), 'Não foi possível salvar a tarefa.'),
    onSetTaskState: (id: string, state: 'pending' | 'completed' | 'waived') => projectMutation(() => dataAccess.setProjectTaskState(id, state), 'Não foi possível atualizar a tarefa.'),
    onDeleteTask: (id: string) => projectMutation(() => dataAccess.deleteProjectTask(id), 'Não foi possível excluir a tarefa.'),
  }

  async function saveItem(draft: RoutineDraft, id?: string) {
    const saved = await dataAccess.saveItem(draft, id)
    setItems((current) => [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
    setDialogItem(undefined)
  }

  async function toggle(item: RoutineItem) {
    const completed = completions.some((entry) => entry.routine_item_id === item.id && entry.local_date === selectedDate && entry.completed_at !== null)
    setError('')
    try {
      const saved = await dataAccess.saveCompletion(item, selectedDate, !completed)
      setCompletions((current) => [...current.filter((entry) => entry.routine_item_id !== saved.routine_item_id || entry.local_date !== saved.local_date), saved])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar esta conclusão.')
    }
  }

  async function archiveItem(id: string) {
    await dataAccess.archiveItem(id)
    setItems((current) => current.filter((item) => item.id !== id))
    setDialogItem(undefined)
  }

  async function signOut() {
    if (!supabase) return
    const { error: signOutError } = await supabase.auth.signOut()
    setAuthError(signOutError?.message ?? '')
  }

  if (configurationError) return <MessageScreen message={configurationError} />
  if (supabase && !authReady) return <MessageScreen message="Verificando sua sessão…" />
  if (supabase && !session) return <><AuthScreen client={supabase} />{authError && <div role="alert" className="fixed bottom-4 left-4 right-4 mx-auto max-w-md rounded-xl bg-red-50 p-4 text-sm text-red-800">{authError}</div>}</>

  return (
    <div className="min-h-screen bg-[#f6f8f5]">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-8 sm:pt-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><Mark /><div><p className="text-lg font-semibold tracking-tight">Minha Rotina</p><p className="text-xs text-muted">Uma semana de cada vez</p></div></div>
          <div className="flex items-center gap-2">{!supabase && <span className="text-xs text-muted">Demonstração local · não sincroniza</span>}{supabase && session && <button onClick={() => void signOut()} className="rounded-full border border-[#dce5dd] px-4 py-2 text-sm font-medium hover:bg-white">Sair</button>}</div>
        </header>

        <nav aria-label="Navegação principal" className="mt-6 flex rounded-full border border-[#e0e8e0] bg-white p-1"><button aria-current={section === 'routine' ? 'page' : undefined} onClick={() => setSection('routine')} className={`flex-1 rounded-full px-4 py-3 text-sm font-medium ${section === 'routine' ? 'bg-ink text-white' : 'text-muted'}`}>Minha Rotina</button><button aria-current={section === 'projects' ? 'page' : undefined} onClick={() => setSection('projects')} className={`flex-1 rounded-full px-4 py-3 text-sm font-medium ${section === 'projects' ? 'bg-ink text-white' : 'text-muted'}`}>Meus Projetos</button></nav>

        <Suspense fallback={<main className="mt-8 rounded-2xl border border-[#e4eae4] bg-white p-6 text-sm text-muted" role="status">Carregando…</main>}>{section === 'projects' ? <main className="mt-8"><Projects tree={projectTree} loading={projectLoading} error={projectError} {...projectActions} /></main> : <RoutineView selectedDate={selectedDate} onSelectDate={setSelectedDate} items={items} completions={completions} loading={loading} error={error} authError={authError} clockNow={clockNow} dialogItem={dialogItem} onToggle={(item) => void toggle(item)} onAddActivity={() => setDialogItem(null)} onEditActivity={setDialogItem} onCloseDialog={() => setDialogItem(undefined)} onSaveItem={saveItem} onArchiveItem={archiveItem} />}</Suspense>
      </div>
    </div>
  )
}

function MessageScreen({ message }: { message: string }) {
  return <main className="grid min-h-screen place-items-center px-5"><div role="status" className="max-w-lg rounded-2xl border border-[#e4eae4] bg-white p-6 text-sm leading-6">{message}</div></main>
}
