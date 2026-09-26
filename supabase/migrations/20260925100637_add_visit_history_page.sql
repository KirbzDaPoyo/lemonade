begin;

-- One statement snapshot for a bounded page and its complete-history summary.
create function public.get_place_visit_history(
  p_saved_place_id text,
  p_before_date date default null,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  owner_id text := nullif(auth.jwt()->>'sub', '');
  result jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if num_nonnulls(p_before_date, p_before_created_at, p_before_id) not in (0, 3) then
    raise exception 'Incomplete history cursor' using errcode = '22023';
  end if;
  with owned_place as (
    select status, updated_at from public.saved_places
    where id = p_saved_place_id and user_id = owner_id
  ), page_window as (
    select id, saved_place_id, visit_date, rating, note, created_at, updated_at
    from public.place_visits
    where user_id = owner_id and saved_place_id = p_saved_place_id
      and (p_before_id is null or (visit_date, created_at, id) < (p_before_date, p_before_created_at, p_before_id))
    order by visit_date desc, created_at desc, id desc limit 21
  ), page as (
    select * from page_window order by visit_date desc, created_at desc, id desc limit 20
  )
  select jsonb_build_object(
    'entries', (select coalesce(jsonb_agg(to_jsonb(page) order by visit_date desc, created_at desc, id desc), '[]'::jsonb) from page),
    'has_more', (select count(*) > 20 from page_window),
    'summary', (select jsonb_build_object('count', count(*), 'latest_date', max(visit_date))
      from public.place_visits where user_id = owner_id and saved_place_id = p_saved_place_id),
    'latest_rated', (select jsonb_build_object('rating', rating, 'visit_date', visit_date)
      from public.place_visits where user_id = owner_id and saved_place_id = p_saved_place_id and rating is not null
      order by visit_date desc, created_at desc, id desc limit 1),
    'place_status', status, 'place_updated_at', updated_at
  ) into result from owned_place;
  if result is null then raise exception 'Saved place unavailable' using errcode = '23503'; end if;
  return result;
end $$;

revoke all on function public.get_place_visit_history(text, date, timestamptz, uuid) from public, anon, service_role;
grant execute on function public.get_place_visit_history(text, date, timestamptz, uuid) to authenticated;
commit;
notify pgrst, 'reload schema';
