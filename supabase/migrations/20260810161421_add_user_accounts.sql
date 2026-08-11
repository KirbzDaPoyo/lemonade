begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.saved_places
  add column if not exists user_id text
    default (auth.jwt()->>'sub');

alter table public.place_tags
  add column if not exists user_id text
    default (auth.jwt()->>'sub');

comment on column public.saved_places.user_id is
  'Clerk user ID from the authenticated JWT subject. Legacy rows are assigned administratively during account rollout.';

comment on column public.place_tags.user_id is
  'Clerk user ID from the authenticated JWT subject. Legacy rows are assigned administratively during account rollout.';

drop index if exists public.saved_places_source_url_unique_idx;
drop index if exists public.saved_places_place_id_unique_idx;
drop index if exists public.place_tags_normalized_name_unique_idx;

create unique index saved_places_user_source_url_unique_idx
  on public.saved_places (user_id, source_url)
  where user_id is not null;

create unique index saved_places_user_place_id_unique_idx
  on public.saved_places (user_id, place_id)
  where user_id is not null and place_id is not null;

create unique index place_tags_user_normalized_name_unique_idx
  on public.place_tags (user_id, lower(btrim(name)))
  where user_id is not null;

drop policy if exists "MVP saved places read access" on public.saved_places;
drop policy if exists "MVP saved places insert access" on public.saved_places;
drop policy if exists "MVP saved places update access" on public.saved_places;
drop policy if exists "MVP saved places delete access" on public.saved_places;

revoke all on public.saved_places from anon;
grant select, insert, update, delete on public.saved_places to authenticated;

create policy "Users read their saved places"
on public.saved_places
for select
to authenticated
using ((select auth.jwt()->>'sub') = user_id);

create policy "Users create their saved places"
on public.saved_places
for insert
to authenticated
with check ((select auth.jwt()->>'sub') = user_id);

create policy "Users update their saved places"
on public.saved_places
for update
to authenticated
using ((select auth.jwt()->>'sub') = user_id)
with check ((select auth.jwt()->>'sub') = user_id);

create policy "Users delete their saved places"
on public.saved_places
for delete
to authenticated
using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists "MVP place tags read access" on public.place_tags;
drop policy if exists "MVP place tags insert access" on public.place_tags;
drop policy if exists "MVP place tags update access" on public.place_tags;
drop policy if exists "MVP place tags delete access" on public.place_tags;

revoke all on public.place_tags from anon;
grant select, insert, update, delete on public.place_tags to authenticated;

create policy "Users read their place tags"
on public.place_tags
for select
to authenticated
using ((select auth.jwt()->>'sub') = user_id);

create policy "Users create their place tags"
on public.place_tags
for insert
to authenticated
with check ((select auth.jwt()->>'sub') = user_id);

create policy "Users update their place tags"
on public.place_tags
for update
to authenticated
using ((select auth.jwt()->>'sub') = user_id)
with check ((select auth.jwt()->>'sub') = user_id);

create policy "Users delete their place tags"
on public.place_tags
for delete
to authenticated
using ((select auth.jwt()->>'sub') = user_id);

create or replace function public.rename_place_tag(p_tag_id uuid, p_name text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_name text;
  clean_name text := btrim(p_name);
  current_user_id text := auth.jwt()->>'sub';
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if char_length(clean_name) not between 1 and 40 then
    raise exception 'Tag name must be between 1 and 40 characters.';
  end if;

  select name
  into old_name
  from public.place_tags
  where id = p_tag_id
    and user_id = current_user_id;

  if old_name is null then
    raise exception 'Tag not found.';
  end if;

  update public.place_tags
  set name = clean_name
  where id = p_tag_id
    and user_id = current_user_id;

  update public.saved_places saved_place
  set user_tags = (
    select coalesce(array_agg(
      case
        when lower(btrim(value)) = lower(btrim(old_name)) then clean_name
        else value
      end
      order by ordinality
    ), '{}'::text[])
    from unnest(saved_place.user_tags)
      with ordinality as values_with_order(value, ordinality)
  )
  where saved_place.user_id = current_user_id
    and exists (
      select 1
      from unnest(saved_place.user_tags) as value
      where lower(btrim(value)) = lower(btrim(old_name))
    );
end;
$$;

create or replace function public.delete_place_tag(p_tag_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_name text;
  current_user_id text := auth.jwt()->>'sub';
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  select name
  into old_name
  from public.place_tags
  where id = p_tag_id
    and user_id = current_user_id;

  if old_name is null then
    raise exception 'Tag not found.';
  end if;

  update public.saved_places saved_place
  set user_tags = coalesce((
    select array_agg(value order by ordinality)
    from unnest(saved_place.user_tags)
      with ordinality as values_with_order(value, ordinality)
    where lower(btrim(value)) <> lower(btrim(old_name))
  ), '{}'::text[])
  where saved_place.user_id = current_user_id
    and exists (
      select 1
      from unnest(saved_place.user_tags) as value
      where lower(btrim(value)) = lower(btrim(old_name))
    );

  delete from public.place_tags
  where id = p_tag_id
    and user_id = current_user_id;
end;
$$;

revoke all on function public.rename_place_tag(uuid, text) from public;
revoke all on function public.delete_place_tag(uuid) from public;
revoke all on function public.rename_place_tag(uuid, text) from anon;
revoke all on function public.delete_place_tag(uuid) from anon;
grant execute on function public.rename_place_tag(uuid, text) to authenticated;
grant execute on function public.delete_place_tag(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
