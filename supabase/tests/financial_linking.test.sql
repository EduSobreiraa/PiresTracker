begin;
select plan(21);

select ok(
  exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'financial_link_sessions'),
  'link sessions table exists'
);
select ok(
  exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'financial_connections'),
  'financial connections table exists'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.financial_connections'::regclass
      and conname = 'financial_connections_provider_item_key'
      and contype = 'u'
  ),
  'a Pluggy Item can be claimed by only one connection'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.financial_link_sessions'::regclass
      and conname = 'financial_link_session_expiry'
      and position('expires_at > created_at' in pg_get_constraintdef(oid)) > 0
      and position('00:30:00' in pg_get_constraintdef(oid)) > 0
  ),
  'link sessions must expire within thirty minutes'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_connections'
      and policyname = 'financial_connections_select_own'
      and cmd = 'SELECT'
  ),
  'connections have an owner-scoped read policy'
);
select ok(
  (select count(*) = 2 from pg_class
    where relnamespace = 'public'::regnamespace
      and relname in ('financial_link_sessions', 'financial_connections')
      and relrowsecurity),
  'row-level security is enabled on both financial tables'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_connections'
      and policyname = 'financial_connections_select_own'
      and position('auth.uid' in qual) > 0
      and position('user_id' in qual) > 0
  ),
  'connection reads compare the authenticated user with user_id'
);
select ok(
  not has_table_privilege('authenticated', 'public.financial_link_sessions', 'SELECT'),
  'authenticated users cannot read link session tokens or hashes'
);
select ok(
  not has_table_privilege('authenticated', 'public.financial_connections', 'INSERT'),
  'authenticated users cannot create unverified connections'
);
select ok(
  has_table_privilege('authenticated', 'public.financial_connections', 'SELECT'),
  'authenticated users can read connections permitted by RLS'
);
select ok(
  not has_function_privilege('authenticated', 'public.confirm_financial_link(uuid, uuid, text, uuid, text, text, timestamp with time zone, timestamp with time zone)', 'EXECUTE'),
  'authenticated users cannot call the privileged confirmation RPC'
);
select ok(
  has_function_privilege('service_role', 'public.confirm_financial_link(uuid, uuid, text, uuid, text, text, timestamp with time zone, timestamp with time zone)', 'EXECUTE'),
  'service role can call the confirmation RPC after Edge Function validation'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'finance-test-1@example.invalid', '', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'finance-test-2@example.invalid', '', now(), now(), now());

insert into public.financial_link_sessions (id, user_id, connect_token_hash)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', repeat('a', 64)),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000102', repeat('b', 64)),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000101', repeat('c', 64)),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000101', repeat('d', 64)),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000101', repeat('e', 64)),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000101', repeat('f', 64));

set local role service_role;

select lives_ok(
  $$select public.confirm_financial_link(
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000101',
    repeat('a', 64),
    '00000000-0000-4000-8000-000000000301',
    'Nubank', 'ACTIVE', null, null
  )$$,
  'confirmation creates a connection and consumes its session'
);
select is(
  public.confirm_financial_link(
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000101',
    repeat('a', 64),
    '00000000-0000-4000-8000-000000000301',
    'Nubank', 'ACTIVE', null, null
  ),
  (select confirmed_connection_id from public.financial_link_sessions where id = '00000000-0000-4000-8000-000000000201'),
  'repeating confirmation returns the same connection'
);
select ok(
  exists (
    select 1 from public.financial_link_sessions s
    join public.financial_connections c on c.id = s.confirmed_connection_id and c.user_id = s.user_id
    where s.id = '00000000-0000-4000-8000-000000000201'
      and s.consumed_at is not null
      and c.external_item_id = '00000000-0000-4000-8000-000000000301'
  ),
  'the session and its connection are committed together'
);
select throws_ok(
  $$select public.confirm_financial_link(
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000102',
    repeat('b', 64),
    '00000000-0000-4000-8000-000000000301',
    'Nubank', 'ACTIVE', null, null
  )$$,
  '23505',
  'ITEM_ALREADY_CLAIMED',
  'another user cannot claim an Item already linked to this account'
);
select ok(
  (select consumed_at is null and confirmed_connection_id is null
   from public.financial_link_sessions where id = '00000000-0000-4000-8000-000000000202'),
  'a rejected claim leaves its session unconsumed'
);
select throws_ok(
  $$select public.confirm_financial_link(
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000101',
    repeat('c', 64),
    '00000000-0000-4000-8000-000000000303',
    'Nubank', 'UNKNOWN', null, null
  )$$,
  '22023',
  'INVALID_FINANCIAL_LINK',
  'confirmation rejects statuses outside the supported set'
);
select throws_ok(
  $$select public.confirm_financial_link(
    '00000000-0000-4000-8000-000000000204',
    '00000000-0000-4000-8000-000000000101',
    repeat('d', 64),
    '00000000-0000-4000-8000-000000000304',
    '   ', 'ACTIVE', null, null
  )$$,
  '22023',
  'INVALID_FINANCIAL_LINK',
  'confirmation rejects blank institution names'
);
select throws_ok(
  $$select public.confirm_financial_link(
    '00000000-0000-4000-8000-000000000205',
    '00000000-0000-4000-8000-000000000101',
    repeat('e', 64),
    '00000000-0000-4000-8000-000000000305',
    repeat('x', 121), 'ACTIVE', null, null
  )$$,
  '22023',
  'INVALID_FINANCIAL_LINK',
  'confirmation rejects institution names longer than the table limit'
);
select throws_ok(
  $$select public.confirm_financial_link(
    '00000000-0000-4000-8000-000000000206',
    '00000000-0000-4000-8000-000000000101',
    'invalid-hash',
    '00000000-0000-4000-8000-000000000306',
    'Nubank', 'ACTIVE', null, null
  )$$,
  '22023',
  'INVALID_FINANCIAL_LINK',
  'confirmation rejects malformed Connect Token hashes'
);

reset role;

select * from finish();
rollback;
