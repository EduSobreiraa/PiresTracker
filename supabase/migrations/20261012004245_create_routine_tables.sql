create table if not exists public.routine_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  title text not null check (length(trim(title)) between 1 and 80),
  category text not null check (category in ('commitment', 'study', 'gym')),
  is_trackable boolean not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint routine_items_time_range check (ends_at > starts_at),
  constraint routine_items_tracking_matches_category check (
    (category = 'commitment' and not is_trackable)
    or (category in ('study', 'gym') and is_trackable)
  ),
  constraint routine_items_id_user_key unique (id, user_id)
);

create table if not exists public.completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_item_id uuid not null,
  local_date date not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint completions_item_owner_fk foreign key (routine_item_id, user_id)
    references public.routine_items (id, user_id) on delete cascade,
  constraint completions_one_per_occurrence unique (user_id, routine_item_id, local_date)
);

create index if not exists routine_items_user_weekday_start_idx
  on public.routine_items (user_id, weekday, starts_at) where active;
create index if not exists completions_user_date_idx
  on public.completions (user_id, local_date);

alter table public.routine_items enable row level security;
alter table public.completions enable row level security;

drop policy if exists routine_items_select_own on public.routine_items;
create policy routine_items_select_own on public.routine_items
  for select using (auth.uid() = user_id);
drop policy if exists routine_items_insert_own on public.routine_items;
create policy routine_items_insert_own on public.routine_items
  for insert with check (auth.uid() = user_id);
drop policy if exists routine_items_update_own on public.routine_items;
create policy routine_items_update_own on public.routine_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists routine_items_delete_own on public.routine_items;
create policy routine_items_delete_own on public.routine_items
  for delete using (auth.uid() = user_id);

drop policy if exists completions_select_own on public.completions;
create policy completions_select_own on public.completions
  for select using (auth.uid() = user_id);
drop policy if exists completions_insert_own on public.completions;
create policy completions_insert_own on public.completions
  for insert with check (auth.uid() = user_id);
drop policy if exists completions_update_own on public.completions;
create policy completions_update_own on public.completions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists completions_delete_own on public.completions;
create policy completions_delete_own on public.completions
  for delete using (auth.uid() = user_id);
