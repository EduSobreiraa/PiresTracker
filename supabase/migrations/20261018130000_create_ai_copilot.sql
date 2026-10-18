create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  unique (id, user_id),
  created_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) between 1 and 4000),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id) references public.ai_conversations(id, user_id) on delete cascade
);
create index ai_messages_user_created_idx on public.ai_messages(user_id, created_at desc);

create table public.ai_proposals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  version uuid not null default gen_random_uuid(),
  kind text not null check (kind = 'create_project_task'),
  project_id uuid not null,
  stage_id uuid not null,
  project_name text not null check (length(trim(project_name)) between 1 and 120),
  stage_title text not null check (length(trim(stage_title)) between 1 and 180),
  title text not null check (length(trim(title)) between 1 and 180),
  planned_week date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  applied_task_id uuid,
  foreign key (conversation_id, user_id) references public.ai_conversations(id, user_id) on delete cascade
);
create index ai_proposals_user_created_idx on public.ai_proposals(user_id, created_at desc);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_proposals enable row level security;
create policy ai_conversations_select_own on public.ai_conversations for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_messages_select_own on public.ai_messages for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_proposals_select_own on public.ai_proposals for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.ai_conversations, public.ai_messages, public.ai_proposals from anon, authenticated;
grant select on public.ai_conversations, public.ai_messages, public.ai_proposals to authenticated;
grant all on public.ai_conversations, public.ai_messages, public.ai_proposals to service_role;

create or replace function public.decide_ai_proposal(proposal_id uuid, proposal_version uuid, decision text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected public.ai_proposals%rowtype;
  task_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if decision is null or decision not in ('approve', 'reject') then raise exception 'INVALID_DECISION'; end if;
  select * into selected from public.ai_proposals
    where id = proposal_id and user_id = auth.uid() for update;
  if not found then raise exception 'PROPOSAL_NOT_FOUND'; end if;
  if selected.version is distinct from proposal_version then raise exception 'PROPOSAL_CHANGED'; end if;
  if selected.status <> 'pending' then raise exception 'PROPOSAL_ALREADY_DECIDED'; end if;
  if selected.expires_at <= now() then raise exception 'PROPOSAL_EXPIRED'; end if;
  if decision = 'approve' then
    if not exists (select 1 from public.project_stages where id = selected.stage_id and project_id = selected.project_id and user_id = selected.user_id and completed_at is null) then
      raise exception 'PROPOSAL_TARGET_UNAVAILABLE';
    end if;
    insert into public.project_tasks (user_id, project_id, stage_id, seed_key, title, planned_week)
    values (selected.user_id, selected.project_id, selected.stage_id, 'ai:' || selected.id::text, selected.title, selected.planned_week)
    returning id into task_id;
  end if;
  update public.ai_proposals set status = case when decision = 'approve' then 'approved' else 'rejected' end,
    decided_at = now(), applied_task_id = task_id where id = selected.id;
  return case when decision = 'approve' then 'approved' else 'rejected' end;
end;
$$;
revoke all on function public.decide_ai_proposal(uuid, uuid, text) from public, anon;
grant execute on function public.decide_ai_proposal(uuid, uuid, text) to authenticated;
