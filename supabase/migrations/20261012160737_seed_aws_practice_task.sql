update public.study_goals
set description = 'O curso foi concluído. A revisão de fundamentos está registrada no objetivo separado; a prática adicional está na tarefa filha.'
where track = 'aws'
  and week_start = date '2026-10-12'
  and title = 'Concluir Exploring Artificial Intelligence Use Cases and Applications'
  and parent_goal_id is null;

insert into public.study_goals (user_id, track, title, description, week_start, parent_goal_id)
select parent.user_id, parent.track, 'Resolver 10 questões adicionais de fixação', null, parent.week_start, parent.id
from public.study_goals as parent
where parent.track = 'aws'
  and parent.week_start = date '2026-10-12'
  and parent.title = 'Concluir Exploring Artificial Intelligence Use Cases and Applications'
  and parent.parent_goal_id is null
on conflict (user_id, week_start, track, title) do nothing;
