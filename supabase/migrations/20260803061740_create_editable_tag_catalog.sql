begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists public.place_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_tags_name_length_check
    check (char_length(btrim(name)) between 1 and 40)
);

create unique index if not exists place_tags_normalized_name_unique_idx
  on public.place_tags (lower(btrim(name)));

create or replace function public.set_place_tags_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists place_tags_set_updated_at on public.place_tags;

create trigger place_tags_set_updated_at
before update on public.place_tags
for each row
execute function public.set_place_tags_updated_at();

alter table public.place_tags enable row level security;

grant select, insert, update, delete on public.place_tags to anon;

drop policy if exists "MVP place tags read access" on public.place_tags;
drop policy if exists "MVP place tags insert access" on public.place_tags;
drop policy if exists "MVP place tags update access" on public.place_tags;
drop policy if exists "MVP place tags delete access" on public.place_tags;

create policy "MVP place tags read access"
on public.place_tags
for select
to anon
using (true);

create policy "MVP place tags insert access"
on public.place_tags
for insert
to anon
with check (true);

create policy "MVP place tags update access"
on public.place_tags
for update
to anon
using (true)
with check (true);

create policy "MVP place tags delete access"
on public.place_tags
for delete
to anon
using (true);

with source_tags as (
  select btrim(value) as name
  from public.saved_places
  cross join lateral unnest(
    coalesce(user_tags, '{}'::text[]) || coalesce(tags, '{}'::text[])
  ) as value
  where btrim(value) <> ''
), distinct_source_tags as (
  select min(name) as name, lower(name) as normalized_name
  from source_tags
  group by lower(name)
)
insert into public.place_tags (name)
select source.name
from distinct_source_tags source
where not exists (
  select 1
  from public.place_tags existing
  where lower(btrim(existing.name)) = source.normalized_name
);

update public.saved_places saved_place
set user_tags = coalesce((
  select array_agg(catalog.name order by source.first_position)
  from (
    select
      lower(btrim(value)) as normalized_name,
      min(ordinality) as first_position
    from unnest(
      coalesce(saved_place.user_tags, '{}'::text[]) ||
      coalesce(saved_place.tags, '{}'::text[])
    ) with ordinality as values_with_order(value, ordinality)
    where btrim(value) <> ''
    group by lower(btrim(value))
  ) source
  join public.place_tags catalog
    on lower(btrim(catalog.name)) = source.normalized_name
), '{}'::text[])
where cardinality(coalesce(saved_place.user_tags, '{}'::text[])) > 0
   or cardinality(coalesce(saved_place.tags, '{}'::text[])) > 0;

create or replace function public.rename_place_tag(p_tag_id uuid, p_name text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_name text;
  clean_name text := btrim(p_name);
begin
  if char_length(clean_name) not between 1 and 40 then
    raise exception 'Tag name must be between 1 and 40 characters.';
  end if;

  select name
  into old_name
  from public.place_tags
  where id = p_tag_id;

  if old_name is null then
    raise exception 'Tag not found.';
  end if;

  update public.place_tags
  set name = clean_name
  where id = p_tag_id;

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
  where exists (
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
begin
  select name
  into old_name
  from public.place_tags
  where id = p_tag_id;

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
  where exists (
    select 1
    from unnest(saved_place.user_tags) as value
    where lower(btrim(value)) = lower(btrim(old_name))
  );

  delete from public.place_tags
  where id = p_tag_id;
end;
$$;

revoke all on function public.rename_place_tag(uuid, text) from public;
revoke all on function public.delete_place_tag(uuid) from public;
grant execute on function public.rename_place_tag(uuid, text) to anon;
grant execute on function public.delete_place_tag(uuid) to anon;

commit;

notify pgrst, 'reload schema';
