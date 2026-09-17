begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.map_position_usage (
 usage_date date not null,
 scope text not null check(scope in ('user','project')),
 subject text not null,
 attempts integer not null check(attempts>=0),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(usage_date,scope,subject),
 check((scope='project' and subject='') or (scope='user' and length(subject)>0))
);
alter table private.map_position_usage enable row level security;
revoke all on private.map_position_usage from public,anon,authenticated;
create function public.reserve_map_positions(subject text,attempts integer,user_cap integer default 60,project_cap integer default 250)
returns text language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare today date:=(clock_timestamp() at time zone 'UTC')::date; total integer; personal integer;
begin
 if subject is null or length(btrim(subject))=0 or length(subject)>200 or attempts is null or attempts<1 or attempts>20 or user_cap is null or user_cap<0 or user_cap>60 or project_cap is null or project_cap<0 or project_cap>250 then raise exception 'Invalid reservation'; end if;
 -- One fixed global lock orders all reservations and deletion cleanup.
 perform pg_advisory_xact_lock(70607001);
 delete from private.map_position_usage where usage_date<today-2;
 insert into private.map_position_usage values(today,'project','',0,clock_timestamp()) on conflict on constraint map_position_usage_pkey do nothing;
 select u.attempts into total from private.map_position_usage u where u.usage_date=today and u.scope='project' and u.subject='' for update;
 select u.attempts into personal from private.map_position_usage u where u.usage_date=today and u.scope='user' and u.subject=reserve_map_positions.subject for update;
 if coalesce(personal,0)+attempts>user_cap then return 'user_quota'; end if;
 if coalesce(total,0)+attempts>project_cap then return 'project_quota'; end if;
 insert into private.map_position_usage values(today,'project','',attempts,clock_timestamp()) on conflict on constraint map_position_usage_pkey do update set attempts=private.map_position_usage.attempts+excluded.attempts,updated_at=excluded.updated_at;
 insert into private.map_position_usage values(today,'user',subject,attempts,clock_timestamp()) on conflict on constraint map_position_usage_pkey do update set attempts=private.map_position_usage.attempts+excluded.attempts,updated_at=excluded.updated_at;
 return 'ok';
end $$;
revoke all on function public.reserve_map_positions(text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_map_positions(text,integer,integer,integer) to service_role;
-- Deletion-only helper derives identity from the verified JWT; no arbitrary subject parameter.
create function private.delete_current_map_usage() returns void language plpgsql security definer set search_path='' as $$
declare owner_id text:=nullif(auth.jwt()->>'sub','');
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(70607001);
 delete from private.map_position_usage where scope='user' and subject=owner_id;
end $$;
revoke all on function private.delete_current_map_usage() from public,anon,service_role;
grant execute on function private.delete_current_map_usage() to authenticated;
grant usage on schema private to authenticated;

create or replace function public.delete_current_user_data()
returns table(saved_places_deleted bigint,place_tags_deleted bigint) language plpgsql security invoker set search_path='' as $$
declare current_user_id text:=nullif(auth.jwt()->>'sub','');
begin
 if current_user_id is null then raise exception 'Authentication is required.'; end if;
 perform private.delete_current_map_usage();
 perform pg_advisory_xact_lock(hashtextextended('import_inbox:' || current_user_id,0));
 delete from public.dining_plans where user_id=current_user_id;
 delete from public.import_inbox_items where user_id=current_user_id;
 delete from public.saved_places where user_id=current_user_id;
 get diagnostics saved_places_deleted=row_count;
 delete from public.place_tags where user_id=current_user_id;
 get diagnostics place_tags_deleted=row_count;
 return next;
end $$;
revoke all on function public.delete_current_user_data() from public,anon,service_role;
grant execute on function public.delete_current_user_data() to authenticated;

commit;
notify pgrst,'reload schema';
