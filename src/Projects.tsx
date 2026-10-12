import { useState } from 'react'
import { addDays, formatDate } from './domain'
import { awsProjectSeed, projectProgress, projectTaskWeeks } from './projectPlan'
import type { Project, ProjectDraft, ProjectStage, ProjectStageDraft, ProjectTask, ProjectTaskDraft, ProjectTree } from './types'

type Editor = { kind: 'project'; id?: string } | { kind: 'stage'; projectId: string; id?: string } | { kind: 'task'; projectId: string; stageId: string; id?: string }
type Draft = { name: string; title: string; description: string; planned_week: string; optional: boolean; waivable: boolean }
type Props = {
  tree: ProjectTree
  loading: boolean
  error: string
  onSaveProject: (draft: ProjectDraft, id?: string) => Promise<void>
  onDeleteProject: (id: string) => Promise<void>
  onSaveStage: (projectId: string, draft: ProjectStageDraft, id?: string) => Promise<void>
  onCompleteStage: (id: string, completed: boolean) => Promise<void>
  onDeleteStage: (id: string) => Promise<void>
  onSaveTask: (projectId: string, stageId: string, draft: ProjectTaskDraft, id?: string) => Promise<void>
  onSetTaskState: (id: string, state: 'pending' | 'completed' | 'waived') => Promise<void>
  onDeleteTask: (id: string) => Promise<void>
}

const emptyDraft: Draft = { name: '', title: '', description: '', planned_week: '', optional: false, waivable: false }

export default function Projects(props: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const selected = props.tree.projects.find((project) => project.id === selectedId)

  function openProject(project?: Project) {
    setDraft({ ...emptyDraft, name: project?.name ?? '', description: project?.description ?? '' })
    setEditor({ kind: 'project', id: project?.id })
  }
  function openStage(projectId: string, stage?: ProjectStage) {
    setDraft({ ...emptyDraft, title: stage?.title ?? '', description: stage?.description ?? '' })
    setEditor({ kind: 'stage', projectId, id: stage?.id })
  }
  function openTask(projectId: string, stageId: string, task?: ProjectTask) {
    setDraft({ ...emptyDraft, title: task?.title ?? '', description: task?.description ?? '', planned_week: task?.planned_week ?? '', optional: task?.optional ?? false, waivable: task?.waivable ?? false })
    setEditor({ kind: 'task', projectId, stageId, id: task?.id })
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!editor) return
    setSaving(true)
    try {
      if (editor.kind === 'project') await props.onSaveProject({ name: draft.name, description: draft.description || null }, editor.id)
      else if (editor.kind === 'stage') await props.onSaveStage(editor.projectId, { title: draft.title, description: draft.description || null, position: editor.id ? props.tree.stages.find((stage) => stage.id === editor.id)?.position ?? 0 : props.tree.stages.filter((stage) => stage.project_id === editor.projectId).length }, editor.id)
      else await props.onSaveTask(editor.projectId, editor.stageId, { title: draft.title, description: draft.description || null, planned_week: draft.planned_week || null, optional: draft.optional, waivable: draft.waivable, position: editor.id ? props.tree.tasks.find((task) => task.id === editor.id)?.position ?? 0 : props.tree.tasks.filter((task) => task.stage_id === editor.stageId).length }, editor.id)
      setEditor(null)
    } catch {}
    finally { setSaving(false) }
  }

  return <section aria-labelledby="projects-heading" className="min-w-0">
    {selected ? <>
      <button onClick={() => setSelectedId(null)} className="rounded-full border border-[#dce5dd] bg-white px-4 py-2 text-sm font-medium hover:bg-moss">‹ Todos os projetos</button>
      <ProjectDetail project={selected} stages={props.tree.stages.filter((stage) => stage.project_id === selected.id)} tasks={props.tree.tasks.filter((task) => task.project_id === selected.id)} {...props} onEdit={() => openProject(selected)} onAddStage={() => openStage(selected.id)} onEditStage={(stage) => openStage(selected.id, stage)} onAddTask={(stageId) => openTask(selected.id, stageId)} onEditTask={(task) => openTask(selected.id, task.stage_id, task)} />
    </> : <>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-muted">Objetivos de médio e longo prazo</p><h1 id="projects-heading" className="mt-1 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Meus Projetos<span className="text-[#a2afa5]">.</span></h1></div><button onClick={() => openProject()} className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white">+ Novo projeto</button></div>
      {props.error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{props.error}</div>}
      {props.loading ? <div role="status" className="mt-5 rounded-2xl border border-[#e4eae4] bg-white p-6 text-sm text-muted">Carregando projetos…</div> : props.tree.projects.length === 0 ? <div className="mt-5 rounded-[1.5rem] border border-dashed border-[#cbd7cc] bg-white/70 px-6 py-9"><h2 className="font-semibold">Nenhum projeto cadastrado.</h2><p className="mt-1 text-sm text-muted">Crie um projeto para organizar suas etapas e tarefas.</p></div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{props.tree.projects.map((project) => {
        const stages = props.tree.stages.filter((stage) => stage.project_id === project.id)
        const tasks = props.tree.tasks.filter((task) => task.project_id === project.id)
        const progress = projectProgress(stages, tasks)
        return <article key={project.id} className="rounded-[1.5rem] border border-[#e4eae4] bg-white p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><button onClick={() => setSelectedId(project.id)} className="min-w-0 flex-1 text-left"><h2 className="text-lg font-semibold">{project.name}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{project.description}</p></button><IconButton label={`Editar ${project.name}`} onClick={() => openProject(project)}><PencilIcon /></IconButton></div>{project.seed_key === awsProjectSeed.key && <p className="mt-4 text-sm font-medium text-[#4e6b57]">Carga estimada: {formatDuration(awsProjectSeed.estimatedMinutes)} <span className="font-normal text-muted">(plano oficial + fundamentos; Escape Room opcional à parte)</span></p>}<div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><span>{progress.completedStages}/{progress.totalStages} etapas concluídas</span><span>{progress.completedTasks}/{progress.totalTasks} tarefas concluídas</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf1ed]"><div className="h-full bg-[#64846f] transition-[width]" style={{ width: `${progress.stagePercent}%` }} /></div><div className="mt-4 flex items-center justify-between"><button onClick={() => setSelectedId(project.id)} className="text-sm font-semibold text-[#4e6b57]">Abrir projeto →</button><button onClick={() => { if (window.confirm(`Excluir o projeto “${project.name}” e suas etapas e tarefas?`)) void props.onDeleteProject(project.id).catch(() => undefined) }} className="rounded-full px-3 py-2 text-sm text-muted hover:bg-red-50 hover:text-red-700">Excluir</button></div></article>
      })}</div>}
    </>}

    {editor && <div className="fixed inset-0 z-30 grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4"><form onSubmit={(event) => void submit(event)} className="w-full max-w-lg rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{editor.id ? 'Editar' : 'Novo'} {editor.kind === 'project' ? 'projeto' : editor.kind === 'stage' ? 'etapa' : 'tarefa'}</h2><button type="button" onClick={() => setEditor(null)} aria-label="Fechar" className="h-10 w-10 rounded-full hover:bg-moss">×</button></div>{props.error && <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{props.error}</div>}<label className="mt-4 block text-sm font-medium">{editor.kind === 'project' ? 'Nome do projeto' : editor.kind === 'stage' ? 'Nome da etapa' : 'Tarefa'}<input autoFocus required maxLength={editor.kind === 'project' ? 120 : 180} value={editor.kind === 'project' ? draft.name : draft.title} onChange={(event) => setDraft({ ...draft, [editor.kind === 'project' ? 'name' : 'title']: event.target.value })} className="mt-2 w-full rounded-xl border-[#dbe4dc] px-3 py-3" /></label><label className="mt-4 block text-sm font-medium">Descrição (opcional)<textarea maxLength={2000} rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-2 w-full rounded-xl border-[#dbe4dc] px-3 py-3" /></label>{editor.kind === 'task' && <><label className="mt-4 block text-sm font-medium">Semana planejada (opcional)<input type="date" value={draft.planned_week} onChange={(event) => setDraft({ ...draft, planned_week: event.target.value })} className="mt-2 w-full rounded-xl border-[#dbe4dc] px-3 py-3" /></label><label className="mt-4 flex items-center gap-3 text-sm"><input type="checkbox" checked={draft.optional} onChange={(event) => setDraft({ ...draft, optional: event.target.checked })} className="h-5 w-5 accent-[#344f42]" />Tarefa opcional</label><label className="mt-3 flex items-center gap-3 text-sm"><input type="checkbox" checked={draft.waivable} onChange={(event) => setDraft({ ...draft, waivable: event.target.checked })} className="h-5 w-5 accent-[#344f42]" />Pode ser dispensada por domínio prévio</label></>}<button disabled={saving || !(editor.kind === 'project' ? draft.name.trim() : draft.title.trim())} className="mt-5 w-full rounded-full bg-ink px-5 py-3 font-medium text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button></form></div>}
  </section>
}

function ProjectDetail({ project, stages, tasks, error, onDeleteProject, onDeleteStage, onDeleteTask, onCompleteStage, onSetTaskState, onEdit, onAddStage, onEditStage, onAddTask, onEditTask }: Props & { project: Project; stages: ProjectStage[]; tasks: ProjectTask[]; onEdit: () => void; onAddStage: () => void; onEditStage: (stage: ProjectStage) => void; onAddTask: (stageId: string) => void; onEditTask: (task: ProjectTask) => void }) {
  const [openStageIds, setOpenStageIds] = useState<string[]>(() => stages[0] ? [stages[0].id] : [])
  const progress = projectProgress(stages, tasks)
  return <section className="mt-5" aria-label={`Projeto ${project.name}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h1 className="text-3xl font-semibold tracking-[-.04em] sm:text-4xl">{project.name}<span className="text-[#a2afa5]">.</span></h1>{project.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{project.description}</p>}</div>
      <div className="flex gap-2"><IconButton label={`Editar ${project.name}`} onClick={onEdit}><PencilIcon /></IconButton><IconButton label={`Excluir ${project.name}`} danger onClick={() => { if (window.confirm(`Excluir o projeto “${project.name}” e suas etapas e tarefas?`)) void onDeleteProject(project.id).catch(() => undefined) }}><TrashIcon /></IconButton></div>
    </div>
    <div className="mt-5 rounded-2xl bg-ink p-5 text-white"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{progress.completedStages}/{progress.totalStages} etapas concluídas</span><span>{progress.completedTasks}/{progress.totalTasks} tarefas obrigatórias concluídas</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-lime transition-[width]" style={{ width: `${progress.stagePercent}%` }} /></div></div>
    {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <div className="mt-7 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Etapas</h2><button onClick={onAddStage} className="rounded-full border border-[#dce5dd] bg-white px-4 py-2.5 text-sm font-medium text-[#4e6b57]">+ Etapa</button></div>
    {stages.length === 0 ? <p className="mt-4 rounded-2xl bg-white p-5 text-sm text-muted">Este projeto ainda não tem etapas.</p> : <div className="mt-3 space-y-3">{[...stages].sort((a, b) => a.position - b.position).map((stage) => {
      const expanded = openStageIds.includes(stage.id)
      return <article key={stage.id} className="rounded-[1.4rem] border border-[#e4eae4] bg-white p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <button aria-expanded={expanded} aria-controls={`stage-${stage.id}`} onClick={() => setOpenStageIds((ids) => expanded ? ids.filter((id) => id !== stage.id) : [...ids, stage.id])} className="flex min-w-0 flex-1 items-start gap-3 text-left">
            <span aria-hidden="true" className="mt-0.5 text-muted">{expanded ? '⌄' : '›'}</span>
            <span className="min-w-0 flex-1"><span className="block font-semibold">{stage.title}</span>{stage.description && <span className="mt-1 block text-xs leading-5 text-muted">{stage.description}</span>}</span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${stage.completed_at ? 'bg-[#eaf1eb] text-[#4e6b57]' : 'bg-[#f0f3f0] text-muted'}`}>{stage.completed_at ? 'Concluída' : 'Em andamento'}</span>
          </button>
          <div className="flex shrink-0 gap-1"><IconButton label={`Editar etapa ${stage.title}`} onClick={() => onEditStage(stage)}><PencilIcon /></IconButton><IconButton label={`Excluir etapa ${stage.title}`} danger onClick={() => { if (window.confirm(`Excluir a etapa “${stage.title}” e suas tarefas?`)) void onDeleteStage(stage.id).catch(() => undefined) }}><TrashIcon /></IconButton></div>
        </div>
        <div id={`stage-${stage.id}`} hidden={!expanded} className="ml-6 mt-4 border-l border-[#e4eae4] pl-4">
          <button onClick={() => void onCompleteStage(stage.id, !stage.completed_at).catch(() => undefined)} className="rounded-full border border-[#dce5dd] px-3 py-2 text-xs font-medium hover:bg-moss">{stage.completed_at ? 'Reabrir etapa' : 'Marcar etapa concluída'}</button>
          <div className="mt-3 space-y-4">{projectTaskWeeks(tasks.filter((task) => task.stage_id === stage.id)).map(({ plannedWeek, tasks: weekTasks }) => <section key={plannedWeek ?? 'unplanned'} className="rounded-xl bg-[#f6f8f5] px-3 py-2 sm:px-4" aria-label={plannedWeek ? weekLabel(plannedWeek) : 'Tarefas sem semana planejada'}>
            <h3 className="py-2 text-xs font-semibold text-[#4e6b57]">{plannedWeek ? weekLabel(plannedWeek) : 'Sem semana planejada'}</h3>
            <ul className="divide-y divide-[#e4eae4]">{weekTasks.map((task) => <li key={task.id} className="flex items-start gap-3 py-3">
              <input type="checkbox" checked={Boolean(task.completed_at)} disabled={Boolean(task.waived_at)} onChange={() => void onSetTaskState(task.id, task.completed_at ? 'pending' : 'completed').catch(() => undefined)} aria-label={`${task.completed_at ? 'Reabrir' : 'Concluir'} ${task.title}`} className="mt-0.5 h-5 w-5 shrink-0 accent-[#344f42]" />
              <div className="min-w-0 flex-1"><p className={`text-sm font-medium ${task.completed_at ? 'text-muted line-through' : ''}`}>{task.title}{task.optional && <span className="ml-2 rounded-full bg-white px-2 py-1 text-[10px] text-muted">Opcional</span>}{task.waived_at && <span className="ml-2 rounded-full bg-white px-2 py-1 text-[10px] text-muted">Dispensada</span>}</p>{task.description && <p className="mt-1 text-xs leading-5 text-muted">{task.description}</p>}{task.completed_at && <p className="mt-1 text-[11px] text-muted">Concluída em {formatDate(task.completed_at.slice(0, 10), { day: 'numeric', month: 'short' })}</p>}</div>
              <div className="flex shrink-0 flex-wrap justify-end"><IconButton label={`Editar tarefa ${task.title}`} onClick={() => onEditTask(task)}><PencilIcon /></IconButton>{task.waivable && !task.completed_at && <button onClick={() => void onSetTaskState(task.id, task.waived_at ? 'pending' : 'waived').catch(() => undefined)} className="rounded-lg px-2 py-2 text-xs text-muted hover:bg-white">{task.waived_at ? 'Reativar' : 'Dispensar'}</button>}<button onClick={() => { if (window.confirm(`Excluir a tarefa “${task.title}”?`)) void onDeleteTask(task.id).catch(() => undefined) }} aria-label={`Excluir tarefa ${task.title}`} className="rounded-lg px-2 py-2 text-xs text-muted hover:bg-red-50 hover:text-red-700">Excluir</button></div>
            </li>)}</ul>
          </section>)}</div>
          <button onClick={() => onAddTask(stage.id)} className="mt-3 rounded-full border border-[#dce5dd] px-3 py-2 text-xs font-medium text-[#4e6b57] hover:bg-moss">+ Tarefa</button>
        </div>
      </article>
    })}</div>}
  </section>
}

function weekLabel(start: string): string {
  return `Semana de ${formatDate(start, { day: 'numeric', month: 'long' })} a ${formatDate(addDays(start, 6), { day: 'numeric', month: 'long', year: 'numeric' })}`
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h${remainingMinutes ? `${String(remainingMinutes).padStart(2, '0')}` : ''}`
}

function IconButton({ label, onClick, danger = false, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted hover:bg-moss ${danger ? 'hover:bg-red-50 hover:text-red-700' : ''}`}>{children}</button>
}

function PencilIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"><path d="m15 5 4 4M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="M13.5 6.5 17.5 10.5" /></svg>
}

function TrashIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
}
