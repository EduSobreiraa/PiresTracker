create table if not exists public.study_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  track text not null check (track in ('aws', 'gpt')),
  title text not null check (length(trim(title)) between 1 and 180),
  description text check (description is null or length(description) <= 1000),
  week_start date not null check (week_start between date '2026-10-12' and date '2026-11-23' and extract(isodow from week_start) = 1),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_goals_seed_identity unique (user_id, week_start, track, title)
);

create index if not exists study_goals_owner_week_idx on public.study_goals (user_id, week_start, track);
alter table public.study_goals enable row level security;

drop policy if exists study_goals_select_own on public.study_goals;
create policy study_goals_select_own on public.study_goals for select using ((select auth.uid()) = user_id);
drop policy if exists study_goals_insert_own on public.study_goals;
create policy study_goals_insert_own on public.study_goals for insert with check ((select auth.uid()) = user_id);
drop policy if exists study_goals_update_own on public.study_goals;
create policy study_goals_update_own on public.study_goals for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists study_goals_delete_own on public.study_goals;
create policy study_goals_delete_own on public.study_goals for delete using ((select auth.uid()) = user_id);

create or replace function public.set_study_goals_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists study_goals_updated_at on public.study_goals;
create trigger study_goals_updated_at before update on public.study_goals
for each row execute function public.set_study_goals_updated_at();

update public.routine_items
set active = false
where active and title ~* '(deslocamento|buscar namorada|deixar namorada|buscar colega)';
