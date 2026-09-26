-- Bounded metadata only: library discovery never loads private reflections.
create or replace function public.get_library_visit_summaries(p_place_ids text[])
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  owner_id text := auth.jwt() ->> 'sub';
  result jsonb;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_place_ids is null or cardinality(p_place_ids) > 200 then
    raise exception 'Supply at most 200 saved places' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'saved_place_id', p.id, 'count', totals.count, 'latest_date', totals.latest_date,
    'latest_rating', rated.rating) order by p.id), '[]'::jsonb)
  into result
  from public.saved_places p
  cross join lateral (
    select count(*) as count, max(v.visit_date) as latest_date
    from public.place_visits v where v.user_id = owner_id and v.saved_place_id = p.id
  ) totals
  left join lateral (
    select v.rating from public.place_visits v
    where v.user_id = owner_id and v.saved_place_id = p.id and v.rating is not null
    order by v.visit_date desc, v.created_at desc, v.id desc limit 1
  ) rated on true
  where p.user_id = owner_id and p.id = any(p_place_ids);
  return result;
end;
$$;
revoke all on function public.get_library_visit_summaries(text[]) from public, anon;
grant execute on function public.get_library_visit_summaries(text[]) to authenticated;
