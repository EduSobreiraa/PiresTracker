import { beforeEach, describe, expect, it } from 'vitest'
import { createDataAccess } from './data'
import { dayItems, weeklyProgress } from './domain'
import { projectProgress, projectTaskWeeks } from './projectPlan'

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
    expect(items.some(({ title }) => /deslocamento|buscar namorada|deixar namorada|buscar colega/i.test(title))).toBe(false)
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

  it('creates only the AWS project in local demo and migrates AWS task history once', async () => {
    const completedAt = '2026-10-12T17:00:00.000Z'
    values.set('minha-rotina-v1', JSON.stringify({ items: [], completions: [], studyGoals: [
      { id: 'aws-task', user_id: null, track: 'aws', week_start: '2026-10-12', title: 'Exam Prep Plan Overview', description: '15 min', completed_at: completedAt, parent_goal_id: 'aws-week', optional: false, waivable: false, waived_at: null, archived_at: null },
      { id: 'gpt-old', user_id: null, track: 'gpt', week_start: '2026-10-12', title: 'Old GPT goal', description: null, completed_at: completedAt, parent_goal_id: null, optional: false, waivable: false, waived_at: null, archived_at: null },
    ] }))
    const data = createDataAccess(null, null)
    const tree = await data.loadProjects()
    const project = tree.projects[0]
    expect(tree.projects).toHaveLength(1)
    expect(project.name).toBe('AWS Certified AI Practitioner (AIF-C01)')
    expect(tree.stages.map(({ title }) => title)).toEqual(['Conhecer o exame', 'Atualizar conhecimentos e habilidades AWS', 'Revisar e praticar os cinco domínios', 'Avaliar a preparação para a certificação'])
    expect(tree.tasks).toHaveLength(35)
    expect(tree.tasks.find(({ title }) => title === 'Exam Prep Plan Overview')).toMatchObject({ id: 'aws-task', completed_at: completedAt })
    expect(tree.tasks.filter(({ waivable }) => waivable)).toHaveLength(6)
    expect(tree.tasks.find(({ title }) => title === 'AWS Escape Room')?.optional).toBe(true)
    expect((JSON.parse(values.get('minha-rotina-v1')!).studyGoals as Array<{ track: string }>).some(({ track }) => track === 'gpt')).toBe(false)
    expect(await data.loadProjects()).toEqual(tree)
    expect(projectProgress(tree.stages, tree.tasks)).toMatchObject({ completedStages: 0, totalStages: 4, completedTasks: 3, totalTasks: 34, stagePercent: 0 })
  })

  it('keeps project, stage, task and waiver states independent through CRUD', async () => {
    const data = createDataAccess(null, null)
    let tree = await data.loadProjects()
    const project = await data.saveProject({ name: 'Projeto manual', description: 'Descrição' })
    const stage = await data.saveProjectStage(project.id, { title: 'Etapa manual', description: null, position: 0 })
    const task = await data.saveProjectTask(project.id, stage.id, { title: 'Tarefa manual', description: null, planned_week: '2026-10-12', optional: false, waivable: true, position: 0 })

    await data.setProjectTaskState(task.id, 'completed')
    tree = await data.loadProjects()
    expect(tree.stages.find(({ id }) => id === stage.id)?.completed_at).toBeNull()
    expect(tree.tasks.find(({ id }) => id === task.id)?.completed_at).not.toBeNull()
    await data.completeProjectStage(stage.id, true)
    await data.setProjectTaskState(task.id, 'pending')
    tree = await data.loadProjects()
    expect(tree.stages.find(({ id }) => id === stage.id)?.completed_at).not.toBeNull()
    expect(tree.tasks.find(({ id }) => id === task.id)?.completed_at).toBeNull()
    await data.setProjectTaskState(task.id, 'waived')
    expect((await data.loadProjects()).tasks.find(({ id }) => id === task.id)?.waived_at).not.toBeNull()
    expect(projectProgress([], [])).toMatchObject({ totalStages: 0, totalTasks: 0, stagePercent: 0, taskPercent: 0 })

    await data.deleteProjectTask(task.id)
    await data.deleteProjectStage(stage.id)
    await data.saveProject({ name: 'Projeto alterado', description: null }, project.id)
    expect((await data.loadProjects()).projects.find(({ id }) => id === project.id)?.name).toBe('Projeto alterado')
    await data.deleteProject(project.id)
    expect((await data.loadProjects()).projects.some(({ id }) => id === project.id)).toBe(false)
  })

  it('groups project tasks by planned week in plan order', () => {
    const task = (id: string, title: string, planned_week: string | null, position: number) => ({ id, user_id: null, project_id: 'project', stage_id: 'stage', seed_key: null, title, description: null, planned_week, position, optional: false, waivable: false, completed_at: null, waived_at: null, created_at: '', updated_at: '' })
    const groups = projectTaskWeeks([
      task('late', 'Domain 4 Practice', '2026-11-02', 0),
      task('early', 'Domain 3 Review — Aplicações de modelos de base', '2026-11-02', 1),
      task('none', 'Tarefa sem data', null, 0),
      task('before', 'Domain 1 Review — Fundamentos de IA e ML', '2026-10-26', 0),
    ])

    expect(groups.map(({ plannedWeek, tasks }) => [plannedWeek, tasks.map(({ id }) => id)])).toEqual([
      ['2026-10-26', ['before']],
      ['2026-11-02', ['early', 'late']],
      [null, ['none']],
    ])
  })
})
