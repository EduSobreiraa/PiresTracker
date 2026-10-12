alter table public.study_goals
  add column if not exists optional boolean not null default false,
  add column if not exists waivable boolean not null default false,
  add column if not exists waived_at timestamptz,
  add column if not exists archived_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.study_goals'::regclass and conname = 'study_goals_completed_or_waived') then
    alter table public.study_goals add constraint study_goals_completed_or_waived
      check (completed_at is null or waived_at is null);
  end if;
end $$;

with objectives(old_title, new_title, new_description, week_start) as (values
  ('Avançar no AWS AI Practitioner Learning Plan', 'Semana 2 — Atualizar conhecimentos AWS', 'Etapa 2 · AWS Artificial Intelligence Practitioner Learning Plan (oito cursos). Os seis cursos restantes podem ser dispensados após avaliar domínio prévio.', date '2026-10-19'),
  ('Revisar domínio 1: Fundamentos de IA e ML', 'Semana 3 — Praticar os domínios 1 e 2', 'Etapa 3 · Analisar e praticar. Revisar Fundamentos de IA e ML e Fundamentos de IA generativa.', date '2026-10-26'),
  ('Estudar domínio 2: Fundamentos de IA Generativa', 'Semana 4 — Praticar os domínios 3 e 4', 'Etapa 3 · Analisar e praticar. Revisar Aplicações de modelos de base e Diretrizes de IA responsável.', date '2026-11-02'),
  ('Estudar domínios 3 e 4', 'Semana 5 — Concluir o domínio 5 e consolidar', 'Etapa 3 · Analisar e praticar. Praticar Segurança, conformidade e governança e revisar erros anteriores.', date '2026-11-09'),
  ('Estudar domínio 5 e revisar os cinco domínios', 'Semana 6 — Diagnosticar e corrigir lacunas', 'Etapa 4 · Avaliar a preparação. Fazer o pré-teste e revisar os domínios com mais erros.', date '2026-11-16'),
  ('Fazer simulado e avaliar preparação para o exame', 'Semana 7 — Avaliar a preparação', 'Etapa 4 · Avaliar a preparação. Fazer o simulado oficial, revisar o resultado e avaliar a prontidão para agendar o exame.', date '2026-11-23')
)
update public.study_goals as goal
set title = objectives.new_title,
    description = case when goal.description is null or goal.description in (
      'Revisar IA generativa e distinguir aprendizado, inferência e modelos fundacionais.',
      'Revisar conceitos essenciais e resolver questões do domínio.',
      'Revisar conceitos de foundation models e resolver exercícios.',
      'Aplicações de Foundation Models e Diretrizes para IA Responsável; resolver questões.',
      'Segurança, Conformidade e Governança; identificar os pontos de maior dificuldade.',
      'Revisar conteúdos com mais erros e avaliar agendamento ou realização do exame.'
    ) then objectives.new_description else goal.description end
from objectives
where goal.track = 'aws' and goal.week_start = objectives.week_start
  and goal.parent_goal_id is null and goal.title = objectives.old_title;

insert into public.study_goals (user_id, track, title, description, week_start)
select distinct user_id, 'aws', 'Semana 1 — Conhecer o exame e atualizar fundamentos',
  'Etapa 1 · Conhecer o exame. Iniciar a preparação oficial e identificar lacunas. As tarefas podem ser concluídas independentemente.', date '2026-10-12'
from public.study_goals where track = 'aws'
on conflict (user_id, week_start, track, title) do nothing;

update public.study_goals as course
set title = case course.title
    when 'AI and ML foundations' then 'Fundamentos de machine learning e inteligência artificial'
    when 'Exploring Artificial Intelligence Use Cases and Applications + Revisão' then 'Descrição dos casos de uso e aplicações da inteligência artificial'
  end,
  description = '1 h · Curso concluído; conclusão preservada.',
  parent_goal_id = objective.id
from public.study_goals as objective
where course.track = 'aws' and course.week_start = date '2026-10-12'
  and course.parent_goal_id is null
  and course.title in ('AI and ML foundations', 'Exploring Artificial Intelligence Use Cases and Applications + Revisão')
  and objective.track = 'aws' and objective.week_start = date '2026-10-12'
  and objective.title = 'Semana 1 — Conhecer o exame e atualizar fundamentos'
  and objective.parent_goal_id is null and objective.user_id = course.user_id;

update public.study_goals as previous_task
set archived_at = coalesce(previous_task.archived_at, now())
where previous_task.track = 'aws' and previous_task.week_start = date '2026-10-12'
  and (previous_task.title = 'Assistir o curso' or previous_task.title = 'Assistir o Curso'
       or previous_task.title = 'Resolver 10 questões adicionais de fixação');

with tasks(week_start, parent_title, title, description, optional, waivable, mark_complete) as (values
  (date '2026-10-12', 'Semana 1 — Conhecer o exame e atualizar fundamentos', 'Exam Prep Plan Overview', '15 min · Conclusão informada pelo usuário.', false, false, true),
  (date '2026-10-12', 'Semana 1 — Conhecer o exame e atualizar fundamentos', 'Exam Prep Overview', '5 min.', false, false, false),
  (date '2026-10-12', 'Semana 1 — Conhecer o exame e atualizar fundamentos', 'Official Practice Question Set — 20 questões', '30 min · Questões oficiais para diagnóstico inicial.', false, false, false),
  (date '2026-10-12', 'Semana 1 — Conhecer o exame e atualizar fundamentos', 'Registrar lacunas identificadas nas questões iniciais', null, false, false, false),
  (date '2026-10-19', 'Semana 2 — Atualizar conhecimentos AWS', 'Práticas responsáveis de inteligência artificial', '1 h · Dispensável por domínio prévio.', false, true, false),
  (date '2026-10-19', 'Semana 2 — Atualizar conhecimentos AWS', 'Desenvolvimento de soluções de machine learning', '1 h · Dispensável por domínio prévio.', false, true, false),
  (date '2026-10-19', 'Semana 2 — Atualizar conhecimentos AWS', 'Desenvolvimento de soluções de inteligência artificial generativa', '1 h · Dispensável por domínio prévio.', false, true, false),
  (date '2026-10-19', 'Semana 2 — Atualizar conhecimentos AWS', 'Fundamentos da engenharia de prompts', '1 h · Dispensável por domínio prévio.', false, true, false),
  (date '2026-10-19', 'Semana 2 — Atualizar conhecimentos AWS', 'Otimização de modelos de base', '1 h · Dispensável por domínio prévio.', false, true, false),
  (date '2026-10-19', 'Semana 2 — Atualizar conhecimentos AWS', 'Segurança, conformidade e governança para soluções de IA', '1 h · Dispensável por domínio prévio.', false, true, false),
  (date '2026-10-26', 'Semana 3 — Praticar os domínios 1 e 2', 'Domain 1 Review — Fundamentos de IA e ML', '1 h 30 min.', false, false, false),
  (date '2026-10-26', 'Semana 3 — Praticar os domínios 1 e 2', 'Domain 1 Practice', '55 min.', false, false, false),
  (date '2026-10-26', 'Semana 3 — Praticar os domínios 1 e 2', 'Domain 1 Practice: AWS SimuLearn', '1 h.', false, false, false),
  (date '2026-10-26', 'Semana 3 — Praticar os domínios 1 e 2', 'Domain 2 Review — Fundamentos de IA generativa', '1 h 30 min.', false, false, false),
  (date '2026-10-26', 'Semana 3 — Praticar os domínios 1 e 2', 'Domain 2 Practice', '45 min.', false, false, false),
  (date '2026-11-02', 'Semana 4 — Praticar os domínios 3 e 4', 'Domain 3 Review — Aplicações de modelos de base', '1 h 30 min.', false, false, false),
  (date '2026-11-02', 'Semana 4 — Praticar os domínios 3 e 4', 'Domain 3 Practice', '45 min.', false, false, false),
  (date '2026-11-02', 'Semana 4 — Praticar os domínios 3 e 4', 'Domain 4 Review — Diretrizes de IA responsável', '1 h 30 min.', false, false, false),
  (date '2026-11-02', 'Semana 4 — Praticar os domínios 3 e 4', 'Domain 4 Practice', '30 min.', false, false, false),
  (date '2026-11-09', 'Semana 5 — Concluir o domínio 5 e consolidar', 'Domain 5 Review — Segurança, conformidade e governança', '1 h 30 min.', false, false, false),
  (date '2026-11-09', 'Semana 5 — Concluir o domínio 5 e consolidar', 'Domain 5 Practice', '30 min.', false, false, false),
  (date '2026-11-09', 'Semana 5 — Concluir o domínio 5 e consolidar', 'Domain 5 Practice: AWS SimuLearn', '1 h.', false, false, false),
  (date '2026-11-09', 'Semana 5 — Concluir o domínio 5 e consolidar', 'Revisar questões incorretas dos domínios anteriores', null, false, false, false),
  (date '2026-11-09', 'Semana 5 — Concluir o domínio 5 e consolidar', 'AWS Escape Room', 'Opcional · estimativa oficial de 6 h.', true, false, false),
  (date '2026-11-16', 'Semana 6 — Diagnosticar e corrigir lacunas', 'Official Pretest — 65 questões', '1 h 30 min.', false, false, false),
  (date '2026-11-16', 'Semana 6 — Diagnosticar e corrigir lacunas', 'Analisar o desempenho geral e por domínio', null, false, false, false),
  (date '2026-11-16', 'Semana 6 — Diagnosticar e corrigir lacunas', 'Revisar os domínios com maior quantidade de erros', null, false, false, false),
  (date '2026-11-16', 'Semana 6 — Diagnosticar e corrigir lacunas', 'Refazer exercícios relevantes quando necessário', null, false, false, false),
  (date '2026-11-23', 'Semana 7 — Avaliar a preparação', 'Official Practice Exam — 65 questões', '1 h 30 min.', false, false, false),
  (date '2026-11-23', 'Semana 7 — Avaliar a preparação', 'Analisar resultado e justificativas', null, false, false, false),
  (date '2026-11-23', 'Semana 7 — Avaliar a preparação', 'Revisar conteúdos com desempenho insuficiente', null, false, false, false),
  (date '2026-11-23', 'Semana 7 — Avaliar a preparação', 'Exam Prep Summary', '5 min.', false, false, false),
  (date '2026-11-23', 'Semana 7 — Avaliar a preparação', 'Avaliar se há preparação suficiente para agendar ou realizar o exame', null, false, false, false)
)
insert into public.study_goals (user_id, track, title, description, week_start, parent_goal_id, optional, waivable, completed_at)
select objective.user_id, 'aws', tasks.title, tasks.description, tasks.week_start, objective.id,
  tasks.optional, tasks.waivable,
  case when tasks.mark_complete then now() else null end
from tasks
join public.study_goals as objective
  on objective.track = 'aws' and objective.week_start = tasks.week_start
 and objective.title = tasks.parent_title and objective.parent_goal_id is null
on conflict (user_id, week_start, track, title) do nothing;
