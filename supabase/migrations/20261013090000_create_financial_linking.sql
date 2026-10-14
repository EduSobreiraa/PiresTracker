create table if not exists public.financial_link_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connect_token_hash text not null check (connect_token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  consumed_at timestamptz,
  confirmed_connection_id uuid,
  created_at timestamptz not null default now(),
  constraint financial_link_session_expiry check (expires_at > created_at and expires_at <= created_at + interval '30 minutes'),
  constraint financial_link_session_consumption check (
    (consumed_at is null and confirmed_connection_id is null)
    or (consumed_at is not null and confirmed_connection_id is not null)
  ),
  constraint financial_link_session_token_key unique (connect_token_hash),
  unique (id, user_id)
);

create table if not exists public.financial_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider = 'pluggy'),
  external_item_id uuid not null,
  institution_name text not null check (length(trim(institution_name)) between 1 and 120),
  status text not null check (status in ('ACTIVE', 'PENDING', 'ERROR', 'DISCONNECTED')),
  last_synced_at timestamptz,
  next_auto_sync_at timestamptz,
  consent_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_connections_provider_item_key unique (provider, external_item_id),
  constraint financial_connections_id_user_key unique (id, user_id)
);

alter table public.financial_link_sessions
  add constraint financial_link_sessions_confirmed_connection_fk
  foreign key (confirmed_connection_id, user_id)
  references public.financial_connections (id, user_id) on delete cascade;

create index if not exists financial_link_sessions_user_expiry_idx
  on public.financial_link_sessions (user_id, expires_at);
create index if not exists financial_connections_user_created_idx
  on public.financial_connections (user_id, created_at desc);

alter table public.financial_link_sessions enable row level security;
alter table public.financial_connections enable row level security;

drop policy if exists financial_connections_select_own on public.financial_connections;
create policy financial_connections_select_own on public.financial_connections
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.confirm_financial_link(
  p_session_id uuid,
  p_user_id uuid,
  p_connect_token_hash text,
  p_external_item_id uuid,
  p_institution_name text,
  p_status text,
  p_next_auto_sync_at timestamptz,
  p_consent_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_session public.financial_link_sessions%rowtype;
  connection_id uuid;
begin
  select * into link_session
  from public.financial_link_sessions
  where id = p_session_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'LINK_SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if link_session.connect_token_hash <> p_connect_token_hash then
    raise exception 'LINK_SESSION_TOKEN_MISMATCH' using errcode = '42501';
  end if;

  if link_session.consumed_at is not null then
    select id into connection_id
    from public.financial_connections
    where id = link_session.confirmed_connection_id
      and user_id = p_user_id
      and provider = 'pluggy'
      and external_item_id = p_external_item_id;

    if connection_id is not null then
      return connection_id;
    end if;
    raise exception 'LINK_SESSION_ALREADY_CONSUMED' using errcode = '42501';
  end if;

  if link_session.expires_at <= now() then
    raise exception 'LINK_SESSION_EXPIRED' using errcode = '42501';
  end if;

  insert into public.financial_connections (
    user_id, provider, external_item_id, institution_name, status,
    next_auto_sync_at, consent_expires_at
  ) values (
    p_user_id, 'pluggy', p_external_item_id, p_institution_name, p_status,
    p_next_auto_sync_at, p_consent_expires_at
  )
  on conflict (provider, external_item_id) do update
    set institution_name = excluded.institution_name,
        status = excluded.status,
        next_auto_sync_at = excluded.next_auto_sync_at,
        consent_expires_at = excluded.consent_expires_at,
        updated_at = now()
    where financial_connections.user_id = excluded.user_id
  returning id into connection_id;

  if connection_id is null then
    raise exception 'ITEM_ALREADY_CLAIMED' using errcode = '23505';
  end if;

  update public.financial_link_sessions
  set consumed_at = now(), confirmed_connection_id = connection_id
  where id = p_session_id and user_id = p_user_id and consumed_at is null;

  if not found then
    raise exception 'LINK_SESSION_ALREADY_CONSUMED' using errcode = '42501';
  end if;

  return connection_id;
end;
$$;

revoke all on function public.confirm_financial_link(uuid, uuid, text, uuid, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.confirm_financial_link(uuid, uuid, text, uuid, text, text, timestamptz, timestamptz) to service_role;

revoke all on public.financial_link_sessions, public.financial_connections from anon, authenticated;
grant select on public.financial_connections to authenticated;
