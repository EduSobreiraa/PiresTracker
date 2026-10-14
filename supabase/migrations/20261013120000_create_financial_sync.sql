create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null,
  external_account_id uuid not null,
  account_type text not null check (account_type in ('BANK', 'CREDIT')),
  subtype text,
  name text not null check (length(trim(name)) between 1 and 200),
  currency_code text not null check (length(currency_code) = 3),
  balance numeric,
  credit_limit numeric,
  available_credit_limit numeric,
  minimum_payment numeric,
  balance_close_date date,
  balance_due_date date,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_accounts_id_user_key unique (id, user_id),
  constraint financial_accounts_connection_external_key unique (connection_id, external_account_id),
  constraint financial_accounts_connection_owner_fk
    foreign key (connection_id, user_id)
    references public.financial_connections (id, user_id) on delete cascade
);

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  external_transaction_id uuid not null,
  transaction_date date not null,
  amount numeric not null,
  currency_code text not null check (length(currency_code) = 3),
  description text not null check (length(description) between 1 and 1000),
  merchant_name text,
  provider_type text,
  operation_type text,
  status text not null check (status in ('PENDING', 'POSTED')),
  provider_category text,
  manual_category text,
  installment_number integer check (installment_number > 0),
  total_installments integer check (total_installments > 0),
  purchase_date date,
  external_bill_id uuid,
  bill_post_date date,
  bill_forecast_month text check (bill_forecast_month is null or bill_forecast_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  raw_metadata jsonb not null check (jsonb_typeof(raw_metadata) = 'object'),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_transactions_account_external_key unique (account_id, external_transaction_id),
  constraint financial_transactions_account_owner_fk
    foreign key (account_id, user_id)
    references public.financial_accounts (id, user_id) on delete cascade,
  constraint financial_transactions_installments_check
    check (total_installments is null or installment_number is null or installment_number <= total_installments)
);

create table public.financial_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  external_bill_id text not null check (length(external_bill_id) between 1 and 128),
  due_date date not null,
  closing_date date,
  total_amount numeric not null,
  currency_code text not null check (length(currency_code) = 3),
  minimum_payment_amount numeric,
  allows_installments boolean,
  raw_metadata jsonb not null check (jsonb_typeof(raw_metadata) = 'object'),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_bills_account_external_key unique (account_id, external_bill_id),
  constraint financial_bills_account_owner_fk
    foreign key (account_id, user_id)
    references public.financial_accounts (id, user_id) on delete cascade
);

create table public.financial_sync_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null,
  status text not null check (status in ('RUNNING', 'SUCCEEDED', 'FAILED')),
  accounts_count integer not null default 0 check (accounts_count >= 0),
  transactions_count integer not null default 0 check (transactions_count >= 0),
  bills_count integer not null default 0 check (bills_count >= 0),
  error_code text check (error_code is null or error_code ~ '^[A-Z0-9_]{1,80}$'),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint financial_sync_execution_state_check check (
    (status = 'RUNNING' and finished_at is null and error_code is null)
    or (status = 'SUCCEEDED' and finished_at is not null and error_code is null)
    or (status = 'FAILED' and finished_at is not null and error_code is not null)
  ),
  constraint financial_sync_executions_connection_owner_fk
    foreign key (connection_id, user_id)
    references public.financial_connections (id, user_id) on delete cascade
);

create index financial_accounts_user_connection_idx
  on public.financial_accounts (user_id, connection_id);
create index financial_transactions_user_date_idx
  on public.financial_transactions (user_id, transaction_date desc);
create index financial_transactions_account_date_idx
  on public.financial_transactions (account_id, transaction_date desc);
create index financial_bills_account_due_idx
  on public.financial_bills (account_id, due_date desc);
create index financial_sync_executions_connection_started_idx
  on public.financial_sync_executions (connection_id, started_at desc);

alter table public.financial_accounts enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.financial_bills enable row level security;
alter table public.financial_sync_executions enable row level security;

create policy financial_accounts_select_own on public.financial_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy financial_transactions_select_own on public.financial_transactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy financial_bills_select_own on public.financial_bills
  for select to authenticated using ((select auth.uid()) = user_id);
create policy financial_sync_executions_select_own on public.financial_sync_executions
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.financial_accounts, public.financial_transactions, public.financial_bills, public.financial_sync_executions from anon, authenticated;
grant select on public.financial_accounts, public.financial_transactions, public.financial_bills, public.financial_sync_executions to authenticated;
grant all on public.financial_accounts, public.financial_transactions, public.financial_bills, public.financial_sync_executions to service_role;
