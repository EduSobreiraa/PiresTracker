create table public.financial_archived_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_row integer not null check (source_row > 0),
  transaction_date date not null,
  history text not null default '',
  description text not null default '',
  amount numeric(14, 2) not null,
  balance numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  constraint financial_archived_transactions_user_source_row_key unique (user_id, source_row)
);

create index financial_archived_transactions_user_date_idx
  on public.financial_archived_transactions (user_id, transaction_date desc);

alter table public.financial_archived_transactions enable row level security;

create policy financial_archived_transactions_select_own
  on public.financial_archived_transactions
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.financial_archived_transactions from anon, authenticated;
grant select on public.financial_archived_transactions to authenticated;
grant all on public.financial_archived_transactions to service_role;
