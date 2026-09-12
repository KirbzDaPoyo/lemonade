begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.import_inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default nullif(auth.jwt()->>'sub', ''),
  source_url text not null check (char_length(source_url) <= 2048 and source_url ~ '^https://www\.instagram\.com/(p|reel)/[^/?#]+/$'),
  origin text not null check (origin in ('share', 'manual')),
  status text not null default 'pending' check (status in ('pending', 'needs_attention')),
  place_name_hint text check (char_length(place_name_hint) <= 200),
  failure_category text check (failure_category in ('private_post', 'unsupported_url', 'rate_limited', 'provider_unavailable', 'no_match', 'network', 'unexpected')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 100000),
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_url)
);
create index import_inbox_user_created_idx on public.import_inbox_items (user_id, created_at desc, id desc);
alter table public.import_inbox_items enable row level security;
revoke all on public.import_inbox_items from public, anon, authenticated, service_role;
grant select, insert, delete on public.import_inbox_items to authenticated;
grant update (place_name_hint, status, failure_category, attempt_count, last_attempt_at) on public.import_inbox_items to authenticated;
create policy inbox_select on public.import_inbox_items for select to authenticated using (user_id = (select auth.jwt()->>'sub'));
create policy inbox_insert on public.import_inbox_items for insert to authenticated with check (user_id = (select auth.jwt()->>'sub'));
create policy inbox_update on public.import_inbox_items for update to authenticated using (user_id = (select auth.jwt()->>'sub')) with check (user_id = (select auth.jwt()->>'sub'));
create policy inbox_delete on public.import_inbox_items for delete to authenticated using (user_id = (select auth.jwt()->>'sub'));

-- Enforce the same bounds even for direct Data API inserts. Every insertion for
-- one owner shares this transaction lock, including callers outside the RPC.
create function public.guard_import_inbox_item() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.user_id is distinct from nullif(auth.jwt()->>'sub', '') then
    raise exception 'Inbox ownership rejected' using errcode = '42501';
  end if;
  new.source_url := public.normalize_instagram_source_url(new.source_url);
  new.place_name_hint := nullif(btrim(new.place_name_hint), '');
  new.updated_at := clock_timestamp();
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended('import_inbox:' || new.user_id, 0));
    if exists (select 1 from public.saved_place_sources where user_id = new.user_id and source_url = new.source_url) then
      raise exception 'Source already saved' using errcode = '23514';
    end if;
    if not exists (select 1 from public.import_inbox_items where user_id = new.user_id and source_url = new.source_url)
       and (select count(*) from public.import_inbox_items where user_id = new.user_id) >= 100 then
      raise exception 'Inbox capacity reached' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_import_inbox before insert or update on public.import_inbox_items for each row execute function public.guard_import_inbox_item();
revoke all on function public.guard_import_inbox_item() from public, anon, service_role;
grant execute on function public.guard_import_inbox_item() to authenticated;

create function public.enqueue_import_inbox(urls text[], capture_origin text)
returns table (source_url text, outcome text, saved_place_id text)
language plpgsql security invoker set search_path = '' as $$
declare
  owner_id text := nullif(auth.jwt()->>'sub', '');
  canonical text;
  raw_url text;
  seen text[] := '{}';
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if urls is null or cardinality(urls) > 20 or capture_origin is null or capture_origin not in ('share', 'manual') then
    raise exception 'Invalid capture batch' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('import_inbox:' || owner_id, 0));
  foreach raw_url in array urls loop
    canonical := public.normalize_instagram_source_url(raw_url);
    source_url := canonical;
    saved_place_id := null;
    if raw_url is null or char_length(raw_url) > 2048 or char_length(canonical) > 2048 or canonical !~ '^https://www\.instagram\.com/(p|reel)/[^/?#]+/$' then
      outcome := 'invalid'; return next; continue;
    end if;
    if canonical = any(seen) then continue; end if;
    seen := array_append(seen, canonical);
    select s.saved_place_id into saved_place_id from public.saved_place_sources s where s.user_id = owner_id and s.source_url = canonical;
    if saved_place_id is not null then outcome := 'already_saved';
    elsif exists (select 1 from public.import_inbox_items i where i.user_id = owner_id and i.source_url = canonical) then outcome := 'already_queued';
    elsif (select count(*) from public.import_inbox_items i where i.user_id = owner_id) >= 100 then outcome := 'capacity_reached';
    else
      insert into public.import_inbox_items (user_id, source_url, origin) values (owner_id, canonical, capture_origin)
        on conflict on constraint import_inbox_items_user_id_source_url_key do nothing;
      if found then outcome := 'queued'; else outcome := 'already_queued'; end if;
    end if;
    return next;
  end loop;
end;
$$;
revoke all on function public.enqueue_import_inbox(text[], text) from public, anon, service_role;
grant execute on function public.enqueue_import_inbox(text[], text) to authenticated;

create function public.begin_inbox_attempt(item_id uuid, hint text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if nullif(auth.jwt()->>'sub', '') is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.import_inbox_items set place_name_hint = nullif(btrim(hint), ''),
    attempt_count = least(attempt_count + 1, 100000), last_attempt_at = clock_timestamp(),
    status = 'pending', failure_category = null
    where id = item_id and user_id = (select auth.jwt()->>'sub');
  if not found then raise exception 'Inbox item unavailable' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.begin_inbox_attempt(uuid, text) from public, anon, service_role;
grant execute on function public.begin_inbox_attempt(uuid, text) to authenticated;

-- Keep the existing return signature so the 0.4 client remains compatible.
create or replace function public.delete_current_user_data()
returns table (saved_places_deleted bigint, place_tags_deleted bigint)
language plpgsql security invoker set search_path = '' as $$
declare current_user_id text := nullif(auth.jwt()->>'sub', '');
begin
  if current_user_id is null then raise exception 'Authentication is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('import_inbox:' || current_user_id, 0));
  delete from public.import_inbox_items where user_id = current_user_id;
  delete from public.saved_places where user_id = current_user_id;
  get diagnostics saved_places_deleted = row_count;
  delete from public.place_tags where user_id = current_user_id;
  get diagnostics place_tags_deleted = row_count;
  return next;
end;
$$;
revoke all on function public.delete_current_user_data() from public, anon, service_role;
grant execute on function public.delete_current_user_data() to authenticated;
commit;
notify pgrst, 'reload schema';
