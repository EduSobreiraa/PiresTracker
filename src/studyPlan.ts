import type { StudyGoalDraft } from './types'

export const studyPlan: StudyGoalDraft[] = [
  { track: 'aws', week_start: '2026-10-12', title: 'Concluir Exploring Artificial Intelligence Use Cases and Applications', description: 'Revisar fundamentos de IA e Machine Learning e resolver questões de fixação.' },
  { track: 'gpt', week_start: '2026-10-12', title: 'Conhecer o ecossistema GPT / ChatGPT', description: 'Mapear funcionalidades e registrar exemplos de aplicações empresariais.' },
  { track: 'aws', week_start: '2026-10-19', title: 'Avançar no AWS AI Practitioner Learning Plan', description: 'Revisar IA generativa e distinguir aprendizado, inferência e modelos fundacionais.' },
  { track: 'gpt', week_start: '2026-10-19', title: 'Explorar funcionalidades e ferramentas do ChatGPT', description: 'Testar modalidades de interação, limitações e boas práticas.' },
  { track: 'aws', week_start: '2026-10-26', title: 'Revisar domínio 1: Fundamentos de IA e ML', description: 'Revisar conceitos essenciais e resolver questões do domínio.' },
  { track: 'gpt', week_start: '2026-10-26', title: 'Estudar ChatGPT Work', description: 'Explorar pesquisa e execução de tarefas e identificar usos corporativos.' },
  { track: 'aws', week_start: '2026-11-02', title: 'Estudar domínio 2: Fundamentos de IA Generativa', description: 'Revisar conceitos de foundation models e resolver exercícios.' },
  { track: 'gpt', week_start: '2026-11-02', title: 'Experimentar funcionalidades do ChatGPT', description: 'Comparar abordagens para uma mesma tarefa e registrar resultados e limitações.' },
  { track: 'aws', week_start: '2026-11-09', title: 'Estudar domínios 3 e 4', description: 'Aplicações de Foundation Models e Diretrizes para IA Responsável; resolver questões.' },
  { track: 'gpt', week_start: '2026-11-09', title: 'Comparar abordagens para tarefas empresariais', description: 'Analisar documentos, pesquisar e produzir conteúdo; registrar vantagens, limites e casos de uso.' },
  { track: 'aws', week_start: '2026-11-16', title: 'Estudar domínio 5 e revisar os cinco domínios', description: 'Segurança, Conformidade e Governança; identificar os pontos de maior dificuldade.' },
  { track: 'gpt', week_start: '2026-11-16', title: 'Consolidar experimentos e descobertas', description: 'Relacionar funcionalidades a problemas reais de negócio.' },
  { track: 'aws', week_start: '2026-11-23', title: 'Fazer simulado e avaliar preparação para o exame', description: 'Revisar conteúdos com mais erros e avaliar agendamento ou realização do exame.' },
  { track: 'gpt', week_start: '2026-11-23', title: 'Consolidar aprendizados de GPT / OpenAI', description: 'Revisar funcionalidades e casos de uso e preparar resumo e próximos tópicos.' },
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
