update public.study_goals
set description = case week_start
  when date '2026-10-12' then 'Etapa 1 · Conhecer o exame. Iniciar a preparação oficial e identificar lacunas. As tarefas podem ser concluídas independentemente.'
  when date '2026-10-19' then 'Etapa 2 · Atualizar conhecimentos AWS. Cursos podem ser dispensados após avaliar domínio prévio.'
  when date '2026-10-26' then 'Etapa 3 · Analisar e praticar. Revisar Fundamentos de IA e ML e Fundamentos de IA generativa.'
  when date '2026-11-02' then 'Etapa 3 · Analisar e praticar. Revisar Aplicações de modelos de base e Diretrizes de IA responsável.'
  when date '2026-11-09' then 'Etapa 3 · Analisar e praticar. Praticar Segurança, conformidade e governança e revisar erros anteriores.'
  when date '2026-11-16' then 'Etapa 4 · Avaliar a preparação. Fazer o pré-teste e revisar os domínios com mais erros.'
  when date '2026-11-23' then 'Etapa 4 · Avaliar a preparação. Fazer o simulado oficial, revisar o resultado e avaliar a prontidão para agendar o exame.'
end
where track = 'aws' and parent_goal_id is null and title in (
  'Semana 1 — Conhecer o exame e atualizar fundamentos',
  'Semana 2 — Atualizar conhecimentos AWS',
  'Semana 3 — Praticar os domínios 1 e 2',
  'Semana 4 — Praticar os domínios 3 e 4',
  'Semana 5 — Concluir o domínio 5 e consolidar',
  'Semana 6 — Diagnosticar e corrigir lacunas',
  'Semana 7 — Avaliar a preparação'
);
