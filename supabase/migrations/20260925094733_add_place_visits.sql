begin;

create table public.place_visits (
  user_id text not null,
  id uuid not null default gen_random_uuid(),
  saved_place_id text not null,
  visit_date date not null check (visit_date between date '0001-01-01' and date '9999-12-31'),
  -- Reject fractional API inputs rather than rounding them to an integer.
  rating numeric check (rating between 1 and 5 and rating = trunc(rating)),
  note text check (char_length(note) <= 2000),
  -- Validation context only; the selected day never becomes a timestamp.
  validation_timezone text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id),
  foreign key (saved_place_id, user_id)
    references public.saved_places(id, user_id) on delete cascade
);

-- History uses keyset paging with this deterministic ordering.
create index place_visits_history on public.place_visits
  (user_id, saved_place_id, visit_date desc, created_at desc, id desc);
create index place_visits_latest_rated on public.place_visits
  (user_id, saved_place_id, visit_date desc, created_at desc, id desc)
  where rating is not null;

alter table public.place_visits enable row level security;
revoke all on public.place_visits from public, anon, authenticated;
grant select, delete on public.place_visits to authenticated;
grant insert (user_id, id, saved_place_id, visit_date, rating, note, validation_timezone),
  update (visit_date, rating, note, validation_timezone) on public.place_visits to authenticated;

create policy visits_select on public.place_visits for select to authenticated
  using (user_id = ((select auth.jwt())->>'sub'));
create policy visits_insert on public.place_visits for insert to authenticated
  with check (user_id = ((select auth.jwt())->>'sub'));
create policy visits_update on public.place_visits for update to authenticated
  using (user_id = ((select auth.jwt())->>'sub'))
  with check (user_id = ((select auth.jwt())->>'sub'));
create policy visits_delete on public.place_visits for delete to authenticated
  using (user_id = ((select auth.jwt())->>'sub'));

create function public.guard_place_visit() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.user_id is distinct from nullif(auth.jwt()->>'sub', '') then
    raise exception 'Ownership rejected' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (
    new.user_id is distinct from old.user_id or new.id is distinct from old.id
    or new.saved_place_id is distinct from old.saved_place_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Visit identity is immutable' using errcode = '42501';
  end if;
  if new.validation_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = new.validation_timezone
  ) then
    raise exception 'Invalid visit time zone' using errcode = '22023';
  end if;
  -- Travel west can make an already valid date appear to be tomorrow.
  -- Only creation or changing the day revalidates the future-date rule.
  if tg_op = 'INSERT' or new.visit_date is distinct from old.visit_date then
    if new.visit_date > (statement_timestamp() at time zone new.validation_timezone)::date then
      raise exception 'Visit date cannot be in the future' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'INSERT' then new.created_at := clock_timestamp(); end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
create trigger guard_place_visit before insert or update on public.place_visits
  for each row execute function public.guard_place_visit();

create function public.mark_place_visited_after_insert() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  -- AFTER INSERT excludes ON CONFLICT DO NOTHING retries. Any failure
  -- rolls back both the journal entry and the lifecycle change.
  update public.saved_places set status = 'visited'
  where id = new.saved_place_id and user_id = new.user_id;
  if not found then
    raise exception 'Saved place unavailable' using errcode = '23503';
  end if;
  return new;
end $$;
create trigger mark_place_visited_after_insert after insert on public.place_visits
  for each row execute function public.mark_place_visited_after_insert();

-- One UUID per draft, reused after uncertain network outcomes. A retry returns
-- the current entry without overwriting later edits or manual status changes.
-- A new visit, including on the same day, must use a new UUID.
create function public.create_place_visit(
  p_id uuid, p_saved_place_id text, p_visit_date date, p_validation_timezone text,
  p_rating numeric default null, p_note text default null
) returns public.place_visits
language plpgsql security invoker set search_path = '' as $$
declare
  owner_id text := nullif(auth.jwt()->>'sub', '');
  result public.place_visits;
begin
  if owner_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'Submission identifier required' using errcode = '22023';
  end if;
  -- Share the existing account-deletion lock.
  perform pg_advisory_xact_lock(hashtextextended('import_inbox:' || owner_id, 0));
  select * into result from public.place_visits where user_id = owner_id and id = p_id;
  if not found then
    insert into public.place_visits
      (user_id, id, saved_place_id, visit_date, validation_timezone, rating, note)
    values (owner_id, p_id, p_saved_place_id, p_visit_date, p_validation_timezone, p_rating, p_note)
    on conflict (user_id, id) do nothing
    returning * into result;
    if not found then
      select * into result from public.place_visits where user_id = owner_id and id = p_id;
    end if;
  end if;
  if result.id is null then
    raise exception 'Visit changed; retry the request' using errcode = '40001';
  end if;
  if result.saved_place_id is distinct from p_saved_place_id then
    raise exception 'Submission identifier already used' using errcode = '22023';
  end if;
  return result;
end $$;

revoke all on function public.guard_place_visit(), public.mark_place_visited_after_insert(),
  public.create_place_visit(uuid, text, date, text, numeric, text) from public, anon, service_role;
grant execute on function public.guard_place_visit(), public.mark_place_visited_after_insert(),
  public.create_place_visit(uuid, text, date, text, numeric, text) to authenticated;

-- No backfill: lifecycle status is not evidence of a dated entry.
-- Account deletion already deletes saved_places, cascading to visits.
commit;
notify pgrst, 'reload schema';
