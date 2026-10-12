with routine_owners as (
  select distinct user_id
  from public.routine_items
  where active
), commute_items (weekday, starts_at, ends_at, title) as (
  values
    (2, '08:45'::time, '09:30'::time, 'Deslocamento até a faculdade (aprox.)'),
    (2, '11:30'::time, '12:00'::time, 'Deslocamento para o trabalho (aprox.)'),
    (2, '18:00'::time, '19:00'::time, 'Deslocamento e deixar namorada (aprox.)'),
    (2, '20:30'::time, '22:00'::time, 'Buscar namorada e retorno (aprox.)'),
    (3, '06:45'::time, '07:30'::time, 'Deslocamento até a faculdade (aprox.)'),
    (3, '11:30'::time, '12:00'::time, 'Deslocamento para o trabalho (aprox.)'),
    (3, '18:00'::time, '19:00'::time, 'Deslocamento e deixar namorada (aprox.)'),
    (3, '21:00'::time, '22:40'::time, 'Buscar namorada e retorno (aprox.)'),
    (4, '08:00'::time, '08:30'::time, 'Banho na academia e buscar colega'),
    (4, '08:30'::time, '09:30'::time, 'Deslocamento e margem para faculdade (aprox.)'),
    (4, '11:30'::time, '12:00'::time, 'Deslocamento para o trabalho (aprox.)'),
    (4, '18:00'::time, '19:00'::time, 'Deslocamento e deixar namorada (aprox.)'),
    (4, '20:30'::time, '22:00'::time, 'Buscar namorada e retorno (aprox.)'),
    (5, '06:45'::time, '07:30'::time, 'Deslocamento até a faculdade (aprox.)'),
    (5, '11:30'::time, '12:00'::time, 'Deslocamento para o trabalho (aprox.)')
)
insert into public.routine_items (user_id, weekday, starts_at, ends_at, title, category, is_trackable)
select routine_owners.user_id, commute_items.weekday, commute_items.starts_at, commute_items.ends_at,
  commute_items.title, 'commitment', false
from routine_owners
cross join commute_items
on conflict (user_id, weekday, starts_at, title, category) do nothing;
