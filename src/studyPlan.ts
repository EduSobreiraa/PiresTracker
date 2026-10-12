import type { StudyGoal } from './types'

const weeks = ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']
type PlanTask = { week_start: string; title: string; description: string | null; optional?: boolean; waivable?: boolean }
const task = (week: number, title: string, description: string | null = null, flags: Pick<PlanTask, 'optional' | 'waivable'> = {}): PlanTask => ({ week_start: weeks[week], title, description, ...flags })

export const awsStudyTasks: PlanTask[] = [
  task(0, 'Exam Prep Plan Overview', '15 min · Conclusão informada pelo usuário.'),
  task(0, 'Exam Prep Overview', '5 min.'),
  task(0, 'Official Practice Question Set — 20 questões', '30 min · Questões oficiais para diagnóstico inicial.'),
  task(0, 'Fundamentos de machine learning e inteligência artificial', '1 h · Curso concluído; conclusão preservada.'),
  task(0, 'Descrição dos casos de uso e aplicações da inteligência artificial', '1 h · Curso concluído; conclusão preservada.'),
  task(0, 'Registrar lacunas identificadas nas questões iniciais'),
  task(1, 'Práticas responsáveis de inteligência artificial', '1 h · Dispensável por domínio prévio.', { waivable: true }),
  task(1, 'Desenvolvimento de soluções de machine learning', '1 h · Dispensável por domínio prévio.', { waivable: true }),
  task(1, 'Desenvolvimento de soluções de inteligência artificial generativa', '1 h · Dispensável por domínio prévio.', { waivable: true }),
  task(1, 'Fundamentos da engenharia de prompts', '1 h · Dispensável por domínio prévio.', { waivable: true }),
  task(1, 'Otimização de modelos de base', '1 h · Dispensável por domínio prévio.', { waivable: true }),
  task(1, 'Segurança, conformidade e governança para soluções de IA', '1 h · Dispensável por domínio prévio.', { waivable: true }),
  task(2, 'Domain 1 Review — Fundamentos de IA e ML', '1 h 30 min.'),
  task(2, 'Domain 1 Practice', '55 min.'),
  task(2, 'Domain 1 Practice: AWS SimuLearn', '1 h.'),
  task(2, 'Domain 2 Review — Fundamentos de IA generativa', '1 h 30 min.'),
  task(2, 'Domain 2 Practice', '45 min.'),
  task(3, 'Domain 3 Review — Aplicações de modelos de base', '1 h 30 min.'),
  task(3, 'Domain 3 Practice', '45 min.'),
  task(3, 'Domain 4 Review — Diretrizes de IA responsável', '1 h 30 min.'),
  task(3, 'Domain 4 Practice', '30 min.'),
  task(4, 'Domain 5 Review — Segurança, conformidade e governança', '1 h 30 min.'),
  task(4, 'Domain 5 Practice', '30 min.'),
  task(4, 'Domain 5 Practice: AWS SimuLearn', '1 h.'),
  task(4, 'Revisar questões incorretas dos domínios anteriores'),
  task(4, 'AWS Escape Room', 'Opcional · estimativa oficial de 6 h.', { optional: true }),
  task(5, 'Official Pretest — 65 questões', '1 h 30 min.'),
  task(5, 'Analisar o desempenho geral e por domínio'),
  task(5, 'Revisar os domínios com maior quantidade de erros'),
  task(5, 'Refazer exercícios relevantes quando necessário'),
  task(6, 'Official Practice Exam — 65 questões', '1 h 30 min.'),
  task(6, 'Analisar resultado e justificativas'),
  task(6, 'Revisar conteúdos com desempenho insuficiente'),
  task(6, 'Exam Prep Summary', '5 min.'),
  task(6, 'Avaliar se há preparação suficiente para agendar ou realizar o exame'),
]

export function isStudyGoal(value: unknown): value is StudyGoal {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string' && 'user_id' in value && (typeof value.user_id === 'string' || value.user_id === null) && 'track' in value && (value.track === 'aws' || value.track === 'gpt') && 'title' in value && typeof value.title === 'string' && 'description' in value && (typeof value.description === 'string' || value.description === null) && 'week_start' in value && typeof value.week_start === 'string' && 'completed_at' in value && (typeof value.completed_at === 'string' || value.completed_at === null) && (!('parent_goal_id' in value) || typeof value.parent_goal_id === 'string' || value.parent_goal_id === null) && (!('waived_at' in value) || typeof value.waived_at === 'string' || value.waived_at === null) && (!('archived_at' in value) || typeof value.archived_at === 'string' || value.archived_at === null)
}
