begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.normalize_instagram_source_url(value text)
returns text
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  clean_value text := btrim(value);
  path_kind text;
  shortcode_value text;
begin
  select (result.matches)[1], (result.matches)[2]
  into path_kind, shortcode_value
  from regexp_match(
    clean_value,
    '^https://(?:www\.)?instagram\.com/(p|reels?)/([^/?#]+)/?(?:[?#].*)?$',
    'i'
  ) as result(matches);

  if shortcode_value is null then
    return clean_value;
  end if;

  return format(
    'https://www.instagram.com/%s/%s/',
    case when lower(path_kind) = 'p' then 'p' else 'reel' end,
    shortcode_value
  );
end;
$$;

comment on function public.normalize_instagram_source_url(text) is
  'Canonicalizes supported Instagram post and reel URLs for per-user source deduplication.';

create or replace function public.is_bounded_text_array(
  values_to_check text[],
  max_items integer,
  max_item_length integer
)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select
    cardinality(values_to_check) <= max_items
    and not exists (
      select 1
      from unnest(values_to_check) as item(value)
      where nullif(btrim(item.value), '') is null
        or char_length(item.value) > max_item_length
    );
$$;


alter table public.saved_places
  add constraint saved_places_id_user_id_unique unique (id, user_id);

create table public.saved_place_sources (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default nullif(auth.jwt()->>'sub', ''),
  saved_place_id text not null,
  platform text not null default 'instagram'
    check (platform = 'instagram'),
  source_url text not null
    constraint saved_place_sources_canonical_url_check check (
      char_length(source_url) <= 2048 and source_url ~ '^https://www\.instagram\.com/(p|reel)/[^/?#]+/$'),
  shortcode text check (shortcode is null or char_length(shortcode) <= 100),
  media_type text not null default 'unknown'
    check (media_type in ('post', 'reel', 'unknown')),
  creator_username text
    check (creator_username is null or char_length(creator_username) <= 100),
  caption_excerpt text
    check (caption_excerpt is null or char_length(caption_excerpt) <= 280),
  recommended_items text[] not null default '{}'
    constraint saved_place_sources_recommended_items_check
      check (public.is_bounded_text_array(recommended_items, 8, 80)),
  vibe_tags text[] not null default '{}'
    constraint saved_place_sources_vibe_tags_check
      check (public.is_bounded_text_array(vibe_tags, 8, 40)),
  thumbnail_url text
    constraint saved_place_sources_thumbnail_url_check
      check (thumbnail_url is null or (char_length(thumbnail_url) <= 2048 and thumbnail_url ~ '^https://')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint saved_place_sources_user_source_unique unique (user_id, source_url),
  constraint saved_place_sources_owned_place_fk
    foreign key (saved_place_id, user_id)
    references public.saved_places (id, user_id)
    on delete cascade
);

comment on table public.saved_place_sources is
  'Bounded Instagram metadata explaining why a user saved a place. Raw provider payloads and media are not stored.';

create index saved_place_sources_place_created_idx
  on public.saved_place_sources (saved_place_id, created_at, id);

create or replace function public.set_saved_place_source_canonical_url()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.source_url = public.normalize_instagram_source_url(new.source_url);
  return new;
end;
$$;

create trigger saved_place_sources_canonicalize_url
before insert or update of source_url on public.saved_place_sources
for each row
execute function public.set_saved_place_source_canonical_url();

insert into public.saved_place_sources (
  user_id,
  saved_place_id,
  platform,
  source_url,
  shortcode,
  media_type
)
select
  saved_place.user_id,
  saved_place.id,
  'instagram',
  public.normalize_instagram_source_url(saved_place.source_url),
  (regexp_match(
    public.normalize_instagram_source_url(saved_place.source_url),
    '^https://www\.instagram\.com/(?:p|reel)/([^/]+)/$'
  ))[1],
  case
    when public.normalize_instagram_source_url(saved_place.source_url) like 'https://www.instagram.com/p/%'
      then 'post'
    when public.normalize_instagram_source_url(saved_place.source_url) like 'https://www.instagram.com/reel/%'
      then 'reel'
    else 'unknown'
  end
from public.saved_places as saved_place
where saved_place.user_id is not null
  and nullif(btrim(saved_place.source_url), '') is not null
on conflict (user_id, source_url) do nothing;

alter table public.saved_place_sources enable row level security;

revoke all on public.saved_place_sources from public;
revoke all on public.saved_place_sources from anon;
revoke all on public.saved_place_sources from authenticated;
grant select, insert on public.saved_place_sources to authenticated;

create policy "Users read their saved place sources"
on public.saved_place_sources
for select
to authenticated
using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users create sources for their saved places"
on public.saved_place_sources
for insert
to authenticated
with check (
  ((select auth.jwt()) ->> 'sub') = user_id
  and exists (
    select 1
    from public.saved_places as saved_place
    where saved_place.id = saved_place_id
      and saved_place.user_id = ((select auth.jwt()) ->> 'sub')
  )
);

create or replace function public.save_place_with_source(
  p_place jsonb,
  p_source jsonb
)
returns table (
  save_outcome text,
  saved_place_id text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id text := nullif(auth.jwt()->>'sub', '');
  canonical_source_url text;
  target_place_id text;
  inserted_source_place_id text;
  created_place_id text;
  created_place boolean := false;
  clean_media_type text;
  clean_thumbnail_url text;
  clean_published_at timestamptz;
  clean_recommended_items text[];
  clean_vibe_tags text[];
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  canonical_source_url := public.normalize_instagram_source_url(p_source->>'sourceUrl');

  if canonical_source_url is null then
    raise exception 'A source URL is required.';
  end if;

  select source.saved_place_id
  into target_place_id
  from public.saved_place_sources as source
  where source.user_id = current_user_id
    and source.source_url = canonical_source_url;

  if target_place_id is not null then
    return query select 'existing_source'::text, target_place_id;
    return;
  end if;

  if nullif(p_place->>'providerPlaceId', '') is not null then
    select place.id
    into target_place_id
    from public.saved_places as place
    where place.user_id = current_user_id
      and place.place_id = p_place->>'providerPlaceId'
    limit 1;
  end if;

  if target_place_id is null then
    begin
      insert into public.saved_places (
        id,
        user_id,
        name,
        address,
        area_or_city,
        category,
        cuisine_or_specialty,
        tags,
        user_tags,
        notes,
        source_url,
        place_id,
        map_url,
        status,
        is_favorite
      ) values (
        p_place->>'id',
        current_user_id,
        p_place->>'name',
        p_place->>'address',
        p_place->>'areaOrCity',
        p_place->>'category',
        nullif(p_place->>'specialty', ''),
        '{}',
        array(select jsonb_array_elements_text(coalesce(p_place->'tags', '[]'::jsonb))),
        nullif(p_place->>'notes', ''),
        canonical_source_url,
        nullif(p_place->>'providerPlaceId', ''),
        nullif(p_place->>'mapUrl', ''),
        coalesce(nullif(p_place->>'status', ''), 'want_to_go'),
        coalesce((p_place->>'favorite')::boolean, false)
      )
      returning id into target_place_id;

      created_place_id := target_place_id;
      created_place := true;
    exception when unique_violation then
      select source.saved_place_id
      into target_place_id
      from public.saved_place_sources as source
      where source.user_id = current_user_id
        and source.source_url = canonical_source_url;

      if target_place_id is not null then
        return query select 'existing_source'::text, target_place_id;
        return;
      end if;

      select place.id
      into target_place_id
      from public.saved_places as place
      where place.user_id = current_user_id
        and (
          (nullif(p_place->>'providerPlaceId', '') is not null
            and place.place_id = p_place->>'providerPlaceId')
          or place.source_url = canonical_source_url
        )
      order by (place.source_url = canonical_source_url) desc
      limit 1;

      if target_place_id is null then
        raise;
      end if;
    end;
  end if;

  clean_media_type := case
    when p_source->>'mediaType' in ('post', 'reel') then p_source->>'mediaType'
    else 'unknown'
  end;
  clean_thumbnail_url := case
    when p_source->>'thumbnailUrl' ~ '^https://' then left(p_source->>'thumbnailUrl', 2048)
    else null
  end;
  clean_published_at := case
    when nullif(p_source->>'publishedAt', '') is not null
      then (p_source->>'publishedAt')::timestamptz
    else null
  end;
  select coalesce(array_agg(left(btrim(value), 80)) filter (where btrim(value) <> ''), '{}')
  into clean_recommended_items
  from jsonb_array_elements_text(coalesce(p_source->'recommendedItems', '[]'::jsonb)) as value;
  select coalesce(array_agg(left(btrim(value), 40)) filter (where btrim(value) <> ''), '{}')
  into clean_vibe_tags
  from jsonb_array_elements_text(coalesce(p_source->'vibeTags', '[]'::jsonb)) as value;

  insert into public.saved_place_sources (
    user_id,
    saved_place_id,
    platform,
    source_url,
    shortcode,
    media_type,
    creator_username,
    caption_excerpt,
    recommended_items,
    vibe_tags,
    thumbnail_url,
    published_at
  ) values (
    current_user_id,
    target_place_id,
    'instagram',
    canonical_source_url,
    left(nullif(btrim(p_source->>'shortcode'), ''), 100),
    clean_media_type,
    left(nullif(btrim(p_source->>'creatorUsername'), ''), 100),
    left(nullif(regexp_replace(btrim(p_source->>'captionExcerpt'), '\s+', ' ', 'g'), ''), 280),
    clean_recommended_items[1:8],
    clean_vibe_tags[1:8],
    clean_thumbnail_url,
    clean_published_at
  )
  on conflict (user_id, source_url) do nothing
  returning saved_place_sources.saved_place_id into inserted_source_place_id;

  if inserted_source_place_id is null then
    if created_place_id is not null then
      delete from public.saved_places
      where id = created_place_id
        and user_id = current_user_id;
    end if;

    select source.saved_place_id
    into target_place_id
    from public.saved_place_sources as source
    where source.user_id = current_user_id
      and source.source_url = canonical_source_url;

    return query select 'existing_source'::text, target_place_id;
    return;
  end if;

  return query select
    (case when created_place then 'created_place' else 'attached_source' end)::text,
    target_place_id;
end;
$$;

comment on function public.save_place_with_source(jsonb, jsonb) is
  'Atomically creates a user-owned place with its first source, attaches a new source, or returns the existing source owner.';

revoke all on function public.is_bounded_text_array(text[], integer, integer) from public;
revoke all on function public.normalize_instagram_source_url(text) from public;
revoke all on function public.set_saved_place_source_canonical_url() from public;
revoke all on function public.save_place_with_source(jsonb, jsonb) from public;
revoke all on function public.save_place_with_source(jsonb, jsonb) from anon;
revoke all on function public.save_place_with_source(jsonb, jsonb) from service_role;
grant execute on function public.normalize_instagram_source_url(text) to authenticated;
grant execute on function public.is_bounded_text_array(text[], integer, integer) to authenticated;
grant execute on function public.save_place_with_source(jsonb, jsonb) to authenticated;

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
  'Deletes only the saved places, cascading sources, and tags owned by the authenticated Clerk JWT subject.';

revoke all on function public.delete_current_user_data() from public;
revoke all on function public.delete_current_user_data() from anon;
revoke all on function public.delete_current_user_data() from service_role;
grant execute on function public.delete_current_user_data() to authenticated;

commit;

notify pgrst, 'reload schema';
