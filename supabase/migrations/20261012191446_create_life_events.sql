create table if not exists public.life_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  event_date date not null,
  description text check (description is null or length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint life_events_id_user_key unique (id, user_id)
);

create index if not exists life_events_user_date_idx
  on public.life_events (user_id, event_date);

alter table public.life_events enable row level security;

drop policy if exists life_events_select_own on public.life_events;
create policy life_events_select_own on public.life_events
  for select using ((select auth.uid()) = user_id);
drop policy if exists life_events_insert_own on public.life_events;
create policy life_events_insert_own on public.life_events
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists life_events_update_own on public.life_events;
create policy life_events_update_own on public.life_events
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists life_events_delete_own on public.life_events;
create policy life_events_delete_own on public.life_events
  for delete using ((select auth.uid()) = user_id);

drop trigger if exists life_events_updated_at on public.life_events;
create trigger life_events_updated_at before update on public.life_events
for each row execute function public.update_project_updated_at();
