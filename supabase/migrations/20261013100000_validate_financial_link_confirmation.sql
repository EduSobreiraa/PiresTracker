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
  if p_external_item_id is null
    or p_connect_token_hash is null
    or p_connect_token_hash !~ '^[0-9a-f]{64}$'
    or p_institution_name is null
    or length(trim(p_institution_name)) not between 1 and 120
    or p_status is null
    or p_status not in ('ACTIVE', 'PENDING', 'ERROR', 'DISCONNECTED') then
    raise exception 'INVALID_FINANCIAL_LINK' using errcode = '22023';
  end if;

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
    p_user_id, 'pluggy', p_external_item_id, trim(p_institution_name), p_status,
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
