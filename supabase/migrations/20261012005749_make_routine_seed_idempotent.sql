create unique index if not exists routine_items_seed_identity_idx
  on public.routine_items (user_id, weekday, starts_at, title, category);
