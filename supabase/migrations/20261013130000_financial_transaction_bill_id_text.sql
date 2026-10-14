alter table public.financial_transactions
  alter column external_bill_id type text
  using external_bill_id::text;
