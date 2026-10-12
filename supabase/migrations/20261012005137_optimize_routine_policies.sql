create index if not exists completions_item_owner_idx
  on public.completions (routine_item_id, user_id);

drop policy if exists routine_items_select_own on public.routine_items;
create policy routine_items_select_own on public.routine_items
  for select using ((select auth.uid()) = user_id);
drop policy if exists routine_items_insert_own on public.routine_items;
create policy routine_items_insert_own on public.routine_items
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists routine_items_update_own on public.routine_items;
create policy routine_items_update_own on public.routine_items
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists routine_items_delete_own on public.routine_items;
create policy routine_items_delete_own on public.routine_items
  for delete using ((select auth.uid()) = user_id);

drop policy if exists completions_select_own on public.completions;
create policy completions_select_own on public.completions
  for select using ((select auth.uid()) = user_id);
drop policy if exists completions_insert_own on public.completions;
create policy completions_insert_own on public.completions
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists completions_update_own on public.completions;
create policy completions_update_own on public.completions
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists completions_delete_own on public.completions;
create policy completions_delete_own on public.completions
  for delete using ((select auth.uid()) = user_id);
