create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seed_key text,
  name text not null check (length(trim(name)) between 1 and 120),
  description text check (description is null or length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index if not exists projects_user_seed_key_idx
  on public.projects (user_id, seed_key) where seed_key is not null;

create table if not exists public.project_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null,
  seed_key text,
  title text not null check (length(trim(title)) between 1 and 180),
  description text check (description is null or length(description) <= 2000),
  position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects(id, user_id) on delete cascade,
  unique (id, project_id, user_id)
);

create unique index if not exists project_stages_seed_key_idx
  on public.project_stages (project_id, seed_key) where seed_key is not null;
create index if not exists project_stages_position_idx
  on public.project_stages (project_id, position);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null,
  stage_id uuid not null,
  seed_key text,
  title text not null check (length(trim(title)) between 1 and 180),
  description text check (description is null or length(description) <= 2000),
  planned_week date,
  position integer not null default 0,
  optional boolean not null default false,
  waivable boolean not null default false,
  completed_at timestamptz,
  waived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects(id, user_id) on delete cascade,
  foreign key (stage_id, project_id, user_id) references public.project_stages(id, project_id, user_id) on delete cascade,
  check (completed_at is null or waived_at is null),
  check (waived_at is null or waivable),
  unique (id, project_id, stage_id, user_id)
);

create unique index if not exists project_tasks_seed_key_idx
  on public.project_tasks (stage_id, seed_key) where seed_key is not null;
create index if not exists project_tasks_position_idx
  on public.project_tasks (stage_id, position);

alter table public.projects enable row level security;
alter table public.project_stages enable row level security;
alter table public.project_tasks enable row level security;

drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects for select using ((select auth.uid()) = user_id);
drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects for insert with check ((select auth.uid()) = user_id);
drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects for delete using ((select auth.uid()) = user_id);

drop policy if exists project_stages_select_own on public.project_stages;
create policy project_stages_select_own on public.project_stages for select using ((select auth.uid()) = user_id);
drop policy if exists project_stages_insert_own on public.project_stages;
create policy project_stages_insert_own on public.project_stages for insert with check ((select auth.uid()) = user_id);
drop policy if exists project_stages_update_own on public.project_stages;
create policy project_stages_update_own on public.project_stages for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists project_stages_delete_own on public.project_stages;
create policy project_stages_delete_own on public.project_stages for delete using ((select auth.uid()) = user_id);

drop policy if exists project_tasks_select_own on public.project_tasks;
create policy project_tasks_select_own on public.project_tasks for select using ((select auth.uid()) = user_id);
drop policy if exists project_tasks_insert_own on public.project_tasks;
create policy project_tasks_insert_own on public.project_tasks for insert with check ((select auth.uid()) = user_id);
drop policy if exists project_tasks_update_own on public.project_tasks;
create policy project_tasks_update_own on public.project_tasks for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists project_tasks_delete_own on public.project_tasks;
create policy project_tasks_delete_own on public.project_tasks for delete using ((select auth.uid()) = user_id);

create or replace function public.update_project_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
for each row execute function public.update_project_updated_at();
drop trigger if exists project_stages_updated_at on public.project_stages;
create trigger project_stages_updated_at before update on public.project_stages
for each row execute function public.update_project_updated_at();
drop trigger if exists project_tasks_updated_at on public.project_tasks;
create trigger project_tasks_updated_at before update on public.project_tasks
for each row execute function public.update_project_updated_at();

with aws_users as (
  select distinct user_id from public.study_goals where track = 'aws'
)
insert into public.projects (user_id, seed_key, name, description)
select user_id,
       'aws_ai_practitioner',
       'AWS Certified AI Practitioner (AIF-C01)',
       'Preparação para a certificação AWS Certified AI Practitioner, seguindo o Exam Prep Plan oficial e os cursos complementares do AWS Artificial Intelligence Practitioner Learning Plan.'
from aws_users
on conflict (user_id, seed_key) where seed_key is not null do nothing;

insert into public.project_stages (user_id, project_id, seed_key, title, description, position)
select p.user_id, p.id, stage.seed_key, stage.title, stage.description, stage.position
from public.projects p
cross join (values
  ('know_exam', 'Conhecer o exame', 'Revisar a estrutura do exame, responder questões oficiais e registrar lacunas iniciais.', 0),
  ('update_aws', 'Atualizar conhecimentos e habilidades AWS', 'Reforçar fundamentos por meio dos oito cursos recomendados; cursos podem ser dispensados por domínio prévio.', 1),
  ('review_practice', 'Revisar e praticar os cinco domínios', 'Revisar conteúdos, responder questões e realizar os laboratórios SimuLearn dos domínios 1 e 5.', 2),
  ('evaluate', 'Avaliar a preparação para a certificação', 'Realizar o pré-teste e o simulado oficial, revisar erros e avaliar a prontidão para agendar o exame.', 3)
) as stage(seed_key, title, description, position)
where p.seed_key = 'aws_ai_practitioner'
on conflict (project_id, seed_key) where seed_key is not null do nothing;

insert into public.project_tasks (
  id, user_id, project_id, stage_id, seed_key, title, description,
  planned_week, position, optional, waivable, completed_at, waived_at
)
select g.id,
       g.user_id,
       p.id,
       s.id,
       'study-goal:' || g.id::text,
       g.title,
       g.description,
       g.week_start,
       row_number() over (partition by s.id order by g.week_start, g.created_at, g.id)::integer - 1,
       g.optional,
       g.waivable,
       g.completed_at,
       g.waived_at
from public.study_goals g
join public.projects p on p.user_id = g.user_id and p.seed_key = 'aws_ai_practitioner'
join public.project_stages s on s.project_id = p.id
  and s.seed_key = case
    when g.week_start in ('2026-10-12', '2026-10-19')
      and g.title not in (
        'Exam Prep Plan Overview',
        'Exam Prep Overview',
        'Official Practice Question Set — 20 questões',
        'Registrar lacunas identificadas nas questões iniciais'
      ) then 'update_aws'
    when g.week_start in ('2026-10-12', '2026-10-19') then 'know_exam'
    when g.week_start in ('2026-10-26', '2026-11-02', '2026-11-09') then 'review_practice'
    when g.week_start in ('2026-11-16', '2026-11-23') then 'evaluate'
  end
where g.track = 'aws'
  and g.parent_goal_id is not null
  and g.archived_at is null
on conflict (stage_id, seed_key) where seed_key is not null do nothing;

delete from public.study_goals where track = 'gpt' and parent_goal_id is not null;
delete from public.study_goals where track = 'gpt' and parent_goal_id is null;
