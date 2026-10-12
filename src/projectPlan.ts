import type { Project, ProjectStage, ProjectTask, StudyGoal } from './types'
import { awsStudyTasks } from './studyPlan'

export const awsProjectSeed = {
  key: 'aws_ai_practitioner',
  name: 'AWS Certified AI Practitioner (AIF-C01)',
  description: 'Preparação para a certificação AWS Certified AI Practitioner, seguindo o Exam Prep Plan oficial e os cursos complementares do AWS Artificial Intelligence Practitioner Learning Plan.',
}

export const awsProjectStages = [
  { key: 'know_exam', title: 'Conhecer o exame', description: 'Revisar a estrutura do exame, responder questões oficiais e registrar lacunas iniciais.' },
  { key: 'update_aws', title: 'Atualizar conhecimentos e habilidades AWS', description: 'Reforçar fundamentos por meio dos oito cursos recomendados; cursos podem ser dispensados por domínio prévio.' },
  { key: 'review_practice', title: 'Revisar e praticar os cinco domínios', description: 'Revisar conteúdos, responder questões e realizar os laboratórios SimuLearn dos domínios 1 e 5.' },
  { key: 'evaluate', title: 'Avaliar a preparação para a certificação', description: 'Realizar o pré-teste e o simulado oficial, revisar erros e avaliar a prontidão para agendar o exame.' },
] as const

const examTasks = new Set([
  'Exam Prep Plan Overview',
  'Exam Prep Overview',
  'Official Practice Question Set — 20 questões',
  'Registrar lacunas identificadas nas questões iniciais',
])

export function awsStageKey(week: string, title: string): string {
  if (['2026-10-12', '2026-10-19'].includes(week)) return examTasks.has(title) ? 'know_exam' : 'update_aws'
  if (['2026-10-26', '2026-11-02', '2026-11-09'].includes(week)) return 'review_practice'
  return 'evaluate'
}

export const awsProjectTasks = awsStudyTasks.map((goal, index) => ({ seed_key: `aws-task:${goal.week_start}:${goal.title}`, stage_key: awsStageKey(goal.week_start, goal.title), title: goal.title, description: goal.description, planned_week: goal.week_start, optional: goal.optional ?? false, waivable: goal.waivable ?? false, position: index }))

export function projectTaskWeeks(tasks: ProjectTask[]) {
  const groups = new Map<string | null, ProjectTask[]>()
  for (const task of tasks) groups.set(task.planned_week, [...(groups.get(task.planned_week) ?? []), task])
  const planOrder = new Map(awsStudyTasks.map((task, index) => [task.title, index]))
  return [...groups.entries()]
    .sort(([a], [b]) => a === null ? 1 : b === null ? -1 : a.localeCompare(b))
    .map(([plannedWeek, weekTasks]) => ({
      plannedWeek,
      tasks: weekTasks.sort((a, b) => (planOrder.get(a.title) ?? Number.MAX_SAFE_INTEGER) - (planOrder.get(b.title) ?? Number.MAX_SAFE_INTEGER) || a.position - b.position),
    }))
}

export function seedLocalAwsProject(goals: StudyGoal[]): { project: Project; stages: ProjectStage[]; tasks: ProjectTask[] } {
  const now = new Date().toISOString()
  const projectId = crypto.randomUUID()
  const project: Project = { id: projectId, user_id: null, seed_key: awsProjectSeed.key, name: awsProjectSeed.name, description: awsProjectSeed.description, created_at: now, updated_at: now }
  const stages = awsProjectStages.map((stage, position): ProjectStage => ({ id: crypto.randomUUID(), user_id: null, project_id: projectId, seed_key: stage.key, title: stage.title, description: stage.description, position, completed_at: null, created_at: now, updated_at: now }))
  const stageIds = new Map(stages.map((stage) => [stage.seed_key!, stage.id]))
  const previousTasks = goals.filter((goal) => goal.track === 'aws' && goal.parent_goal_id && !goal.archived_at)
  const aliases = new Map([
    ['AI and ML foundations', 'Fundamentos de machine learning e inteligência artificial'],
    ['Exploring Artificial Intelligence Use Cases and Applications', 'Descrição dos casos de uso e aplicações da inteligência artificial'],
    ['Concluir Exploring Artificial Intelligence Use Cases and Applications', 'Descrição dos casos de uso e aplicações da inteligência artificial'],
  ])
  const previousByTitle = new Map(previousTasks.map((goal) => [aliases.get(goal.title) ?? goal.title, goal]))
  const migratedIds = new Set<string>()
  const tasks = awsProjectTasks.map((planTask, position) => {
    const previous = previousByTitle.get(planTask.title)
    if (previous) migratedIds.add(previous.id)
    const presumedComplete = ['Exam Prep Plan Overview', 'Fundamentos de machine learning e inteligência artificial', 'Descrição dos casos de uso e aplicações da inteligência artificial'].includes(planTask.title)
    return { ...planTask, id: previous?.id ?? crypto.randomUUID(), title: previous?.title && aliases.has(previous.title) ? planTask.title : previous?.title ?? planTask.title, description: previous?.description ?? planTask.description, planned_week: previous?.week_start ?? planTask.planned_week, optional: previous?.optional ?? planTask.optional, waivable: previous?.waivable ?? planTask.waivable, completed_at: previous ? previous.completed_at : presumedComplete ? now : null, waived_at: previous?.waived_at ?? null, position }
  })
  for (const previous of previousTasks.filter((goal) => !migratedIds.has(goal.id))) tasks.push({ id: previous.id, seed_key: `study-goal:${previous.id}`, stage_key: awsStageKey(previous.week_start, previous.title), title: previous.title, description: previous.description, planned_week: previous.week_start, optional: previous.optional, waivable: previous.waivable, completed_at: previous.completed_at, waived_at: previous.waived_at, position: tasks.length })
  const savedTasks = tasks.map((task): ProjectTask => ({ id: task.id, user_id: null, project_id: projectId, stage_id: stageIds.get(task.stage_key)!, seed_key: task.seed_key, title: task.title, description: task.description, planned_week: task.planned_week, position: task.position, optional: task.optional, waivable: task.waivable, completed_at: task.completed_at, waived_at: task.waived_at, created_at: now, updated_at: now }))
  return { project, stages, tasks: savedTasks }
}

export function projectProgress(stages: ProjectStage[], tasks: ProjectTask[]) {
  const trackable = tasks.filter((task) => !task.optional && !task.waived_at)
  const completedTasks = trackable.filter((task) => task.completed_at)
  return {
    completedStages: stages.filter((stage) => stage.completed_at).length,
    totalStages: stages.length,
    completedTasks: completedTasks.length,
    totalTasks: trackable.length,
    stagePercent: stages.length ? Math.round(stages.filter((stage) => stage.completed_at).length / stages.length * 100) : 0,
    taskPercent: trackable.length ? Math.round(completedTasks.length / trackable.length * 100) : 0,
  }
}

export function isProject(value: unknown): value is Project {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' && 'name' in value && typeof value.name === 'string' && 'description' in value && (typeof value.description === 'string' || value.description === null) && 'seed_key' in value && (typeof value.seed_key === 'string' || value.seed_key === null)
}

export function isProjectStage(value: unknown): value is ProjectStage {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' && 'project_id' in value && typeof value.project_id === 'string' && 'title' in value && typeof value.title === 'string' && 'position' in value && typeof value.position === 'number' && 'completed_at' in value && (typeof value.completed_at === 'string' || value.completed_at === null)
}

export function isProjectTask(value: unknown): value is ProjectTask {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' && 'project_id' in value && typeof value.project_id === 'string' && 'stage_id' in value && typeof value.stage_id === 'string' && 'title' in value && typeof value.title === 'string' && 'optional' in value && typeof value.optional === 'boolean' && 'waivable' in value && typeof value.waivable === 'boolean' && 'completed_at' in value && (typeof value.completed_at === 'string' || value.completed_at === null) && 'waived_at' in value && (typeof value.waived_at === 'string' || value.waived_at === null)
}
