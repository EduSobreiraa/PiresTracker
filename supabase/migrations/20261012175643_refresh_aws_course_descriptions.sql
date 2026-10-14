update public.study_goals
set description = '1 h · Curso concluído; conclusão preservada.'
where track = 'aws' and week_start = date '2026-10-12'
  and title in (
    'Fundamentos de machine learning e inteligência artificial',
    'Descrição dos casos de uso e aplicações da inteligência artificial'
  ) and archived_at is null;
