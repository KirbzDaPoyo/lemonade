begin;

create table private.map_position_quota_exemptions (
  subject text primary key check(length(subject) between 1 and 200),
  note text not null default 'developer' check(length(note) between 1 and 100),
  created_at timestamptz not null default clock_timestamp()
);

alter table private.map_position_quota_exemptions enable row level security;
revoke all on private.map_position_quota_exemptions from public,anon,authenticated;

create or replace function public.reserve_map_positions(
  subject text,
  attempts integer,
  user_cap integer default 60,
  project_cap integer default 250
)
returns text language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
  today date := (clock_timestamp() at time zone 'UTC')::date;
  total integer;
  personal integer;
begin
  if subject is null or length(btrim(subject))=0 or length(subject)>200
    or attempts is null or attempts<1 or attempts>20
    or user_cap is null or user_cap<0 or user_cap>60
    or project_cap is null or project_cap<0 or project_cap>250
  then
    raise exception 'Invalid reservation';
  end if;

  if exists (
    select 1
    from private.map_position_quota_exemptions exemption
    where exemption.subject=reserve_map_positions.subject
  ) then
    return 'ok';
  end if;

  perform pg_advisory_xact_lock(70607001);
  delete from private.map_position_usage where usage_date<today-2;
  insert into private.map_position_usage
  values(today,'project','',0,clock_timestamp())
  on conflict on constraint map_position_usage_pkey do nothing;
  select usage.attempts into total
  from private.map_position_usage usage
  where usage.usage_date=today and usage.scope='project' and usage.subject=''
  for update;
  select usage.attempts into personal
  from private.map_position_usage usage
  where usage.usage_date=today
    and usage.scope='user'
    and usage.subject=reserve_map_positions.subject
  for update;
  if coalesce(personal,0)+attempts>user_cap then return 'user_quota'; end if;
  if coalesce(total,0)+attempts>project_cap then return 'project_quota'; end if;
  insert into private.map_position_usage
  values(today,'project','',attempts,clock_timestamp())
  on conflict on constraint map_position_usage_pkey do update
  set attempts=private.map_position_usage.attempts+excluded.attempts,
      updated_at=excluded.updated_at;
  insert into private.map_position_usage
  values(today,'user',subject,attempts,clock_timestamp())
  on conflict on constraint map_position_usage_pkey do update
  set attempts=private.map_position_usage.attempts+excluded.attempts,
      updated_at=excluded.updated_at;
  return 'ok';
end $$;

revoke all on function public.reserve_map_positions(text,integer,integer,integer)
from public,anon,authenticated;
grant execute on function public.reserve_map_positions(text,integer,integer,integer)
to service_role;

create or replace function private.delete_current_map_usage()
returns void language plpgsql security definer set search_path='' as $$
declare owner_id text:=nullif(auth.jwt()->>'sub','');
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(70607001);
  delete from private.map_position_usage
  where scope='user' and subject=owner_id;
  delete from private.map_position_quota_exemptions
  where subject=owner_id;
end $$;

commit;
notify pgrst,'reload schema';
