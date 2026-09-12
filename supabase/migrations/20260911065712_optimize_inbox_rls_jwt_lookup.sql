begin;
alter policy inbox_select on public.import_inbox_items using (user_id = ((select auth.jwt())->>'sub'));
alter policy inbox_insert on public.import_inbox_items with check (user_id = ((select auth.jwt())->>'sub'));
alter policy inbox_update on public.import_inbox_items using (user_id = ((select auth.jwt())->>'sub')) with check (user_id = ((select auth.jwt())->>'sub'));
alter policy inbox_delete on public.import_inbox_items using (user_id = ((select auth.jwt())->>'sub'));
commit;
