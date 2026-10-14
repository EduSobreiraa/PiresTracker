update public.study_goals
set description = 'Etapa 2 · AWS Artificial Intelligence Practitioner Learning Plan (oito cursos). Os seis cursos restantes podem ser dispensados após avaliar domínio prévio.'
where track = 'aws' and week_start = date '2026-10-19'
  and parent_goal_id is null and title = 'Semana 2 — Atualizar conhecimentos AWS';
