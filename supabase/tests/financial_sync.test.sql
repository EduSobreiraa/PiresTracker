begin;
select plan(24);

select ok(to_regclass('public.financial_accounts') is not null, 'financial accounts table exists');
select ok(to_regclass('public.financial_transactions') is not null, 'financial transactions table exists');
select ok(to_regclass('public.financial_bills') is not null, 'financial bills table exists');
select ok(to_regclass('public.financial_sync_executions') is not null, 'financial sync executions table exists');
select is((select count(*)::integer from pg_class where relnamespace = 'public'::regnamespace and relname in ('financial_accounts', 'financial_transactions', 'financial_bills', 'financial_sync_executions') and relrowsecurity), 4, 'RLS is enabled on every financial sync table');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename in ('financial_accounts', 'financial_transactions', 'financial_bills', 'financial_sync_executions') and cmd = 'SELECT' and position('auth.uid' in qual) > 0 and position('user_id' in qual) > 0), 4, 'each financial sync table has an owner-scoped read policy');
select ok(
  has_table_privilege('authenticated', 'public.financial_accounts', 'SELECT')
  and has_table_privilege('authenticated', 'public.financial_transactions', 'SELECT')
  and has_table_privilege('authenticated', 'public.financial_bills', 'SELECT')
  and has_table_privilege('authenticated', 'public.financial_sync_executions', 'SELECT'),
  'authenticated users can read rows allowed by RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.financial_accounts', 'INSERT')
  and not has_table_privilege('authenticated', 'public.financial_transactions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.financial_bills', 'INSERT')
  and not has_table_privilege('authenticated', 'public.financial_sync_executions', 'INSERT'),
  'authenticated users cannot write financial sync rows directly'
);
select ok(exists (select 1 from pg_constraint where conrelid = 'public.financial_accounts'::regclass and conname = 'financial_accounts_connection_external_key' and contype = 'u'), 'accounts are unique within a connection');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.financial_transactions'::regclass and conname = 'financial_transactions_account_external_key' and contype = 'u'), 'transactions are unique within an account');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.financial_bills'::regclass and conname = 'financial_bills_account_external_key' and contype = 'u'), 'bills are unique within a credit account');
select is((select count(*)::integer from pg_constraint where conrelid in ('public.financial_accounts'::regclass, 'public.financial_transactions'::regclass, 'public.financial_bills'::regclass, 'public.financial_sync_executions'::regclass) and conname like '%_owner_fk' and contype = 'f'), 4, 'each imported record is constrained to its connection or account owner');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.financial_transactions'::regclass and conname = 'financial_transactions_status_check'), 'transaction status is limited to pending or posted');
select is((select data_type from information_schema.columns where table_schema = 'public' and table_name = 'financial_transactions' and column_name = 'external_bill_id'), 'text', 'transaction bill ids use the provider string format');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.financial_sync_executions'::regclass and conname = 'financial_sync_execution_state_check'), 'sync status and completion fields must agree');

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000401', 'authenticated', 'authenticated', 'finance-sync-1@example.invalid', '', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000402', 'authenticated', 'authenticated', 'finance-sync-2@example.invalid', '', now(), now(), now());

set local role service_role;

insert into public.financial_connections (id, user_id, provider, external_item_id, institution_name, status)
values ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000401', 'pluggy', '00000000-0000-4000-8000-000000000421', 'Nubank', 'ACTIVE');

insert into public.financial_accounts (id, user_id, connection_id, external_account_id, account_type, subtype, name, currency_code, balance)
values ('00000000-0000-4000-8000-000000000431', '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000441', 'BANK', 'CHECKING_ACCOUNT', 'Conta', 'BRL', 100);

insert into public.financial_transactions (user_id, account_id, external_transaction_id, transaction_date, amount, currency_code, description, provider_type, status, provider_category, raw_metadata)
values ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000431', '00000000-0000-4000-8000-000000000451', '2026-10-13', -25, 'BRL', 'Compra', 'DEBIT', 'PENDING', 'Food', '{}');
update public.financial_transactions set manual_category = 'Categoria manual' where external_transaction_id = '00000000-0000-4000-8000-000000000451';
insert into public.financial_transactions (user_id, account_id, external_transaction_id, transaction_date, amount, currency_code, description, provider_type, status, provider_category, raw_metadata)
values ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000431', '00000000-0000-4000-8000-000000000451', '2026-10-13', -25, 'BRL', 'Compra', 'DEBIT', 'POSTED', 'Groceries', '{}')
on conflict (account_id, external_transaction_id) do update
set status = excluded.status, provider_category = excluded.provider_category, raw_metadata = excluded.raw_metadata, last_synced_at = now(), updated_at = now();

select is((select count(*)::integer from public.financial_transactions where external_transaction_id = '00000000-0000-4000-8000-000000000451'), 1, 'reimporting a transaction does not create a duplicate');
select is((select status from public.financial_transactions where external_transaction_id = '00000000-0000-4000-8000-000000000451'), 'POSTED', 'reimport updates a pending transaction to posted');
select is((select provider_category from public.financial_transactions where external_transaction_id = '00000000-0000-4000-8000-000000000451'), 'Groceries', 'reimport refreshes the provider category');
select is((select manual_category from public.financial_transactions where external_transaction_id = '00000000-0000-4000-8000-000000000451'), 'Categoria manual', 'reimport preserves a manual category omitted from provider data');
select is((select raw_metadata from public.financial_transactions where external_transaction_id = '00000000-0000-4000-8000-000000000451'), '{}'::jsonb, 'financial sync keeps unused provider metadata empty');

insert into public.financial_bills (user_id, account_id, external_bill_id, due_date, total_amount, currency_code, raw_metadata)
values ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000431', 'bill-sample-1', '2026-10-20', 320, 'BRL', '{"totalAmount":320}');
insert into public.financial_sync_executions (user_id, connection_id, status, accounts_count, transactions_count, bills_count, finished_at)
values ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000411', 'SUCCEEDED', 1, 1, 1, now());
select is((select total_amount from public.financial_bills where external_bill_id = 'bill-sample-1'), 320::numeric, 'bill amount is stored without deriving it from transactions');
select is((select bills_count from public.financial_sync_executions where status = 'SUCCEEDED'), 1, 'sync execution stores summary counts');

reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000402', true);
set local role authenticated;
select is((select count(*)::integer from public.financial_transactions), 0, 'another owner cannot read imported transactions');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000401', true);
set local role authenticated;
select is((select count(*)::integer from public.financial_transactions), 1, 'the owner can read their imported transaction');

reset role;
select * from finish();
rollback;
