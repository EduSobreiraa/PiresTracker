import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import ActivityDialog from './ActivityDialog'
import AuthScreen, { Mark } from './AuthScreen'
import Projects from './Projects'
import { addDays, bahiaToday, currentOrNextActivity, dayItems, formatDate, weeklyProgress, weekdayShort, weekStart } from './domain'
import { createDataAccess } from './data'
import { configurationError, supabase } from './supabase'
import type { Completion, ProjectDraft, ProjectStageDraft, ProjectTaskDraft, ProjectTree, RoutineDraft, RoutineItem } from './types'

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
  const dates = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek, index))
  const visibleItems = dayItems(items, selectedDate)
  const highlighted = currentOrNextActivity(items, selectedDate, clockNow)
  const progress = weeklyProgress(items, completions, startOfWeek)
  const today = bahiaToday(clockNow)
  const selectedIsToday = selectedDate === today

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

  const dateTitle = selectedIsToday ? 'Hoje' : formatDate(selectedDate, { weekday: 'long' })
  const weekLabel = `${formatDate(startOfWeek, { day: 'numeric', month: 'long' })} – ${formatDate(addDays(startOfWeek, 6), { day: 'numeric', month: 'long' })}`
  return (
    <div className="min-h-screen bg-[#f6f8f5]">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-8 sm:pt-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><Mark /><div><p className="text-lg font-semibold tracking-tight">Minha Rotina</p><p className="text-xs text-muted">Uma semana de cada vez</p></div></div>
          <div className="flex items-center gap-2">{!supabase && <span className="text-xs text-muted">Demonstração local · não sincroniza</span>}{supabase && session && <button onClick={() => void signOut()} className="rounded-full border border-[#dce5dd] px-4 py-2 text-sm font-medium hover:bg-white">Sair</button>}</div>
        </header>

        <nav aria-label="Navegação principal" className="mt-6 flex rounded-full border border-[#e0e8e0] bg-white p-1"><button aria-current={section === 'routine' ? 'page' : undefined} onClick={() => setSection('routine')} className={`flex-1 rounded-full px-4 py-3 text-sm font-medium ${section === 'routine' ? 'bg-ink text-white' : 'text-muted'}`}>Minha Rotina</button><button aria-current={section === 'projects' ? 'page' : undefined} onClick={() => setSection('projects')} className={`flex-1 rounded-full px-4 py-3 text-sm font-medium ${section === 'projects' ? 'bg-ink text-white' : 'text-muted'}`}>Meus Projetos</button></nav>

        {section === 'projects' ? <main className="mt-8"><Projects tree={projectTree} loading={projectLoading} error={projectError} {...projectActions} /></main> : <main className="mt-9 grid gap-6 lg:grid-cols-[minmax(0,1fr)_270px] lg:items-start">
          <section className="min-w-0" aria-labelledby="day-heading">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-sm font-medium capitalize text-muted">{formatDate(selectedDate, { day: 'numeric', month: 'long', year: 'numeric' })}</p><h1 id="day-heading" className="mt-1 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">{dateTitle}<span className="text-[#a2afa5]">.</span></h1></div>
              <button onClick={() => setDialogItem(null)} className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-[#244b3f]">+ Nova atividade</button>
            </div>

            <section aria-label="Navegação da semana" className="mt-7 rounded-[1.6rem] border border-[#e4eae4] bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm font-semibold capitalize">{weekLabel}</p><div className="flex items-center gap-1"><button onClick={() => setSelectedDate((date) => addDays(date, -7))} aria-label="Semana anterior" className="grid h-9 w-9 place-items-center rounded-full hover:bg-moss">‹</button><button onClick={() => setSelectedDate(today)} className="rounded-full px-3 py-2 text-xs font-semibold hover:bg-moss">Hoje</button><button onClick={() => setSelectedDate((date) => addDays(date, 7))} aria-label="Próxima semana" className="grid h-9 w-9 place-items-center rounded-full hover:bg-moss">›</button></div></div>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">{dates.map((date) => { const active = date === selectedDate; const isToday = date === today; const index = dates.indexOf(date); return <button key={date} aria-pressed={active} onClick={() => setSelectedDate(date)} className={`min-w-0 rounded-2xl px-1 py-2.5 text-center transition sm:py-3 ${active ? 'bg-ink text-white' : 'hover:bg-moss'}`}><span className={`block text-[11px] font-medium capitalize sm:text-xs ${active ? 'text-white/70' : 'text-muted'}`}>{weekdayShort[(index + 1) % 7]}</span><span className="mt-1 block text-lg font-semibold leading-6">{formatDate(date, { day: 'numeric' })}</span><span className={`mx-auto mt-1 block h-1 w-1 rounded-full ${isToday ? active ? 'bg-lime' : 'bg-[#8ca63b]' : 'bg-transparent'}`} aria-hidden="true" /></button> })}</div>
            </section>

            <div className="mt-8 flex items-center justify-between"><h2 className="text-lg font-semibold">Compromissos do dia</h2><span className="text-xs text-muted">{visibleItems.length} {visibleItems.length === 1 ? 'atividade' : 'atividades'}</span></div>
            {(error || authError) && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error || authError}</div>}
            {loading ? <div role="status" className="mt-5 rounded-2xl border border-[#e4eae4] bg-white p-6 text-sm text-muted">Carregando sua rotina…</div> : visibleItems.length === 0 ? <div className="mt-4 rounded-[1.6rem] border border-dashed border-[#cbd7cc] bg-white/70 px-6 py-9 sm:px-8"><div className="flex items-start gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-moss text-lg" aria-hidden="true">＋</div><div><p className="font-semibold">Este dia está livre por enquanto.</p><p className="mt-1 max-w-md text-sm leading-6 text-muted">Adicione uma atividade recorrente para começar a montar sua semana. Ela aparecerá aqui toda semana neste dia.</p><button onClick={() => setDialogItem(null)} className="mt-4 text-sm font-semibold underline decoration-[#a6b79c] underline-offset-4">Adicionar atividade</button></div></div></div> : <ol className="mt-4 space-y-2">{visibleItems.map((item) => { const done = completions.some((entry) => entry.routine_item_id === item.id && entry.local_date === selectedDate && entry.completed_at !== null); const tracked = item.is_trackable; const highlight = highlighted?.item.id === item.id ? highlighted.status : null; return <li key={item.id} className="group grid grid-cols-[58px_16px_minmax(0,1fr)_36px] items-stretch gap-2 sm:grid-cols-[66px_18px_minmax(0,1fr)_40px] sm:gap-3"><time className="pt-5 text-right text-xs font-medium tabular-nums text-muted sm:text-sm">{item.starts_at.slice(0, 5)}</time><div className="relative flex justify-center"><span className="absolute bottom-0 top-0 w-px bg-[#dce5dd]" aria-hidden="true" /><span className={`relative mt-5 h-2.5 w-2.5 rounded-full ring-4 ring-[#f6f8f5] ${item.category === 'gym' ? 'bg-[#91aa3c]' : item.category === 'study' ? 'bg-[#57816d]' : 'bg-[#b1beb4]'}`} aria-hidden="true" /></div><article aria-current={highlight ? 'time' : undefined} className={`my-1 flex min-w-0 items-center justify-between gap-3 rounded-2xl px-4 py-3.5 transition ${done ? 'bg-[#eaf1eb]' : 'bg-white'} ${tracked ? 'cursor-pointer' : ''} ${highlight ? 'ring-1 ring-[#9aaa63]' : ''}`} onClick={tracked ? () => void toggle(item) : undefined}><div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 className={`truncate text-sm font-semibold sm:text-[15px] ${done ? 'text-[#617168]' : ''}`}>{item.title}</h3><span className="rounded-full bg-[#f0f3f0] px-2 py-0.5 text-[10px] font-medium text-[#6f7b72]">{categoryLabel(item.category)}</span>{highlight && <span className="rounded-full bg-[#eaf1d7] px-2 py-0.5 text-[10px] font-semibold text-[#4b5e25]">{highlight === 'current' ? 'Agora' : 'A seguir'}</span>}</div><p className="mt-1 text-xs text-muted">{item.starts_at.slice(0, 5)} – {item.ends_at.slice(0, 5)}{tracked ? ' · toque para marcar' : ''}</p></div>{tracked && <button type="button" role="checkbox" aria-checked={done} aria-label={`${done ? 'Desmarcar' : 'Marcar'} ${item.title} como concluído`} onClick={(event) => { event.stopPropagation(); void toggle(item) }} className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition ${done ? 'border-ink bg-ink text-lime' : 'border-[#bdcbbf] bg-white hover:border-ink'}`}>{done && <span aria-hidden="true">✓</span>}</button>}</article><button onClick={() => setDialogItem(item)} aria-label={`Editar ${item.title}`} className="my-1 grid h-10 w-9 place-items-center self-center rounded-xl text-muted opacity-70 hover:bg-white hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">⋯</button></li> })}</ol>}
          </section>

          <aside className="lg:sticky lg:top-6" aria-labelledby="week-summary"><section className="rounded-[1.6rem] bg-ink p-5 text-white sm:p-6"><div className="flex items-center justify-between"><h2 id="week-summary" className="text-base font-semibold">Seu ritmo na semana</h2><span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-lime" aria-hidden="true">↗</span></div><p className="mt-1 text-xs text-white/60">Só atividades acompanháveis contam aqui.</p><div className="mt-6 space-y-5"><Progress label="Academia" value={progress.gymDone} planned={progress.gymPlanned} unit="treinos" /><Progress label="Estudos" value={progress.studyDone} planned={progress.studyPlanned} unit="sessões" /></div></section><p className="mt-4 px-1 text-xs leading-5 text-muted">Os compromissos ficam no seu roteiro. Estudos e academia têm checklist por data.</p></aside>
        </main>}
      </div>
      {dialogItem !== undefined && <ActivityDialog item={dialogItem} weekday={dates.indexOf(selectedDate) < 0 ? 0 : new Date(`${selectedDate}T00:00:00Z`).getUTCDay()} onClose={() => setDialogItem(undefined)} onSave={saveItem} onArchive={archiveItem} />}
    </div>
  )
}

function Progress({ label, value, planned, unit }: { label: string; value: number; planned: number; unit: string }) {
  const shown = label === 'Academia' ? Math.min(value, planned) : value
  const percentage = planned ? Math.min((shown / planned) * 100, 100) : 0
  return <div><div className="flex items-baseline justify-between gap-3"><p className="text-sm font-medium">{label}</p><p className="text-xs text-white/60">{shown}<span className="px-1">/</span>{planned} {unit}</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-lime transition-[width]" style={{ width: `${percentage}%` }} /></div></div>
}

function categoryLabel(category: RoutineItem['category']): string {
  switch (category) {
    case 'commitment': return 'Compromisso'
    case 'study': return 'Estudos'
    case 'gym': return 'Academia'
  }
}

function MessageScreen({ message }: { message: string }) {
  return <main className="grid min-h-screen place-items-center px-5"><div role="status" className="max-w-lg rounded-2xl border border-[#e4eae4] bg-white p-6 text-sm leading-6">{message}</div></main>
}
