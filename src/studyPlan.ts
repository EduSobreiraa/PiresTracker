import type { StudyGoalDraft } from './types'

export const studyPlan: StudyGoalDraft[] = [
  { track: 'aws', week_start: '2026-10-12', title: 'Concluir Exploring Artificial Intelligence Use Cases and Applications', description: null },
  { track: 'aws', week_start: '2026-10-12', title: 'Revisar os fundamentos de IA e Machine Learning', description: null },
  { track: 'aws', week_start: '2026-10-12', title: 'Resolver questões de fixação dos conteúdos estudados', description: null },
  { track: 'gpt', week_start: '2026-10-12', title: 'Conhecer o ecossistema GPT / ChatGPT', description: null },
  { track: 'gpt', week_start: '2026-10-12', title: 'Identificar as principais funcionalidades disponíveis', description: null },
  { track: 'gpt', week_start: '2026-10-12', title: 'Registrar exemplos de aplicações empresariais', description: null },
  { track: 'aws', week_start: '2026-10-19', title: 'Avançar nos conteúdos fundamentais do AWS AI Practitioner Learning Plan', description: null },
  { track: 'aws', week_start: '2026-10-19', title: 'Revisar os principais conceitos de IA generativa', description: null },
  { track: 'aws', week_start: '2026-10-19', title: 'Distinguir aprendizado, inferência e modelos fundacionais', description: null },
  { track: 'gpt', week_start: '2026-10-19', title: 'Estudar funcionalidades e ferramentas do ChatGPT', description: null },
  { track: 'gpt', week_start: '2026-10-19', title: 'Explorar diferentes modalidades de interação com modelos', description: null },
  { track: 'gpt', week_start: '2026-10-19', title: 'Identificar limitações e boas práticas de utilização', description: null },
  { track: 'aws', week_start: '2026-10-26', title: 'Revisar conceitos essenciais do domínio 1: Fundamentos de IA e ML', description: null },
  { track: 'aws', week_start: '2026-10-26', title: 'Resolver questões relacionadas ao domínio 1', description: null },
  { track: 'aws', week_start: '2026-10-26', title: 'Iniciar revisão direcionada ao domínio 1 do exame', description: null },
  { track: 'gpt', week_start: '2026-10-26', title: 'Estudar ChatGPT Work e seus principais casos de uso', description: null },
  { track: 'gpt', week_start: '2026-10-26', title: 'Explorar possibilidades de pesquisa e execução de tarefas', description: null },
  { track: 'gpt', week_start: '2026-10-26', title: 'Identificar aplicações relevantes para ambientes corporativos', description: null },
  { track: 'aws', week_start: '2026-11-02', title: 'Estudar o domínio 2: Fundamentos de IA Generativa', description: null },
  { track: 'aws', week_start: '2026-11-02', title: 'Revisar conceitos de foundation models', description: null },
  { track: 'aws', week_start: '2026-11-02', title: 'Resolver exercícios de fixação do domínio 2', description: null },
  { track: 'gpt', week_start: '2026-11-02', title: 'Realizar experimentos com as funcionalidades estudadas', description: null },
  { track: 'gpt', week_start: '2026-11-02', title: 'Comparar abordagens diferentes para uma mesma tarefa', description: null },
  { track: 'gpt', week_start: '2026-11-02', title: 'Registrar resultados e limitações dos experimentos', description: null },
  { track: 'aws', week_start: '2026-11-09', title: 'Estudar o domínio 3: Aplicações de Foundation Models', description: null },
  { track: 'aws', week_start: '2026-11-09', title: 'Estudar o domínio 4: Diretrizes para IA Responsável', description: null },
  { track: 'aws', week_start: '2026-11-09', title: 'Resolver questões dos domínios 3 e 4', description: null },
  { track: 'gpt', week_start: '2026-11-09', title: 'Comparar abordagens para análise documental', description: null },
  { track: 'gpt', week_start: '2026-11-09', title: 'Comparar abordagens para pesquisa e produção de conteúdo', description: null },
  { track: 'gpt', week_start: '2026-11-09', title: 'Registrar vantagens, limitações e aplicações empresariais', description: null },
  { track: 'aws', week_start: '2026-11-16', title: 'Estudar o domínio 5: Segurança, Conformidade e Governança', description: null },
  { track: 'aws', week_start: '2026-11-16', title: 'Revisar os conteúdos dos cinco domínios', description: null },
  { track: 'aws', week_start: '2026-11-16', title: 'Identificar os conteúdos de maior dificuldade', description: null },
  { track: 'gpt', week_start: '2026-11-16', title: 'Consolidar os experimentos realizados', description: null },
  { track: 'gpt', week_start: '2026-11-16', title: 'Documentar descobertas relevantes', description: null },
  { track: 'gpt', week_start: '2026-11-16', title: 'Relacionar funcionalidades a problemas reais de negócio', description: null },
  { track: 'aws', week_start: '2026-11-23', title: 'Realizar um pretest ou simulado', description: null },
  { track: 'aws', week_start: '2026-11-23', title: 'Revisar conteúdos com maior índice de erro', description: null },
  { track: 'aws', week_start: '2026-11-23', title: 'Avaliar a preparação para agendar ou realizar o exame', description: null },
  { track: 'gpt', week_start: '2026-11-23', title: 'Revisar as funcionalidades estudadas', description: null },
  { track: 'gpt', week_start: '2026-11-23', title: 'Consolidar os principais casos de uso identificados', description: null },
  { track: 'gpt', week_start: '2026-11-23', title: 'Preparar resumo dos aprendizados e próximos tópicos', description: null },
]

export const studyPlanWeeks = studyPlan.filter((goal, index, goals) => goals.findIndex(({ week_start }) => week_start === goal.week_start) === index).map(({ week_start }) => week_start)

export function initialStudyWeek(today: string): string {
  if (today < studyPlanWeeks[0]) return studyPlanWeeks[0]
  if (today >= studyPlanWeeks[studyPlanWeeks.length - 1]) return studyPlanWeeks[studyPlanWeeks.length - 1]
  return studyPlanWeeks.reduce((closest, week) => week <= today ? week : closest, studyPlanWeeks[0])
}

export function isStudyGoal(value: unknown): value is import('./types').StudyGoal {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' && 'user_id' in value && (typeof value.user_id === 'string' || value.user_id === null) && 'track' in value && (value.track === 'aws' || value.track === 'gpt') && 'title' in value && typeof value.title === 'string' && 'description' in value && (typeof value.description === 'string' || value.description === null) && 'week_start' in value && typeof value.week_start === 'string' && 'completed_at' in value && (typeof value.completed_at === 'string' || value.completed_at === null)
}
