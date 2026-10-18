alter table public.financial_connections
  add column if not exists classification_checkpoint_at timestamptz;

update public.financial_connections
set classification_checkpoint_at = last_synced_at
where classification_checkpoint_at is null and last_synced_at is not null;
