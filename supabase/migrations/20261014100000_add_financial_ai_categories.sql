alter table public.financial_transactions
  add column ai_category text,
  add column ai_classified_at timestamptz,
  add constraint financial_transactions_ai_category_check
    check (ai_category is null or ai_category in (
      'alimentacao', 'moradia', 'transporte', 'saude', 'educacao', 'lazer', 'compras',
      'contas_assinaturas', 'tarifas_impostos', 'transferencias', 'receitas', 'outros'
    ));
