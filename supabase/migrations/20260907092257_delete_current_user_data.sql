begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter function public.set_saved_places_updated_at()
  set search_path = '';

create or replace function public.delete_current_user_data()
returns table (
  saved_places_deleted bigint,
  place_tags_deleted bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id text := nullif(auth.jwt()->>'sub', '');
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  delete from public.saved_places
  where user_id = current_user_id;
  get diagnostics saved_places_deleted = row_count;

  delete from public.place_tags
  where user_id = current_user_id;
  get diagnostics place_tags_deleted = row_count;

  return next;
end;
$$;

comment on function public.delete_current_user_data() is
  'Deletes only the saved places and tags owned by the authenticated Clerk JWT subject.';

revoke all on function public.delete_current_user_data() from public;
revoke all on function public.delete_current_user_data() from anon;
revoke all on function public.delete_current_user_data() from service_role;
grant execute on function public.delete_current_user_data() to authenticated;

commit;

notify pgrst, 'reload schema';
