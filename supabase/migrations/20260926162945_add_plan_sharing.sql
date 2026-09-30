begin;
set local lock_timeout = '5s';
create schema if not exists private;

create table private.plan_shares (
 plan_id uuid primary key, user_id text not null,
 title text not null default 'Places to try' check(title=btrim(title) and char_length(title) between 1 and 80 and title !~ '[[:cntrl:]]'),
 enabled boolean not null default false, revision integer not null default 0 check(revision>=0),
 verifier text unique, credential jsonb, credential_revision integer,
 last_request uuid, last_digest text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 foreign key(plan_id,user_id) references public.dining_plans(id,user_id) on delete cascade,
 check((not enabled and verifier is null and credential is null and credential_revision is null)
    or (enabled and verifier is not null and verifier ~ '^[0-9a-f]{64}$' and credential is not null and credential_revision is not null))
);
create index plan_shares_owner on private.plan_shares(user_id);
create table private.plan_share_labels (
 member_id uuid primary key references public.dining_plan_items(id) on delete cascade,
 name text not null check(name=btrim(name) and char_length(name) between 1 and 200 and name !~ '[[:cntrl:]]'),
 location text check(location is null or (location=btrim(location) and char_length(location) between 1 and 300 and location !~ '[[:cntrl:]]')),
 provenance text not null default 'owner_authored' check(provenance='owner_authored'),
 updated_at timestamptz not null default clock_timestamp()
);
create table private.sharing_usage (
 scope text not null check(scope in ('public','owner')),
 bucket text not null, window_start bigint not null,
 attempts integer not null check(attempts>=0),
 primary key(scope,bucket,window_start)
);
create index sharing_usage_expiry on private.sharing_usage(window_start);
alter table private.plan_shares enable row level security;
alter table private.plan_share_labels enable row level security;
alter table private.sharing_usage enable row level security;
revoke all on private.plan_shares, private.plan_share_labels, private.sharing_usage from public,anon,authenticated,service_role;

-- Internal projection never selects legacy names, addresses, sources or notes.
create function private.sharing_projection(p_plan uuid, p_title text)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when count(*)>20 or count(*)<>count(l.member_id) then null
 else jsonb_build_object('schemaVersion',1,'title',p_title,'places',
 coalesce(jsonb_agg(jsonb_build_object('name',l.name,'location',l.location,
 'providerPlaceId',case when s.place_id ~ '^[A-Za-z0-9_-]{1,255}$' then s.place_id else null end)
 order by i.created_at,i.id) filter(where i.id is not null),'[]'::jsonb)) end
 from public.dining_plan_items i
 join public.saved_places s on s.id=i.saved_place_id and s.user_id=i.user_id
 left join private.plan_share_labels l on l.member_id=i.id
 where i.plan_id=p_plan
$$;

create function private.manage_plan_sharing(p_subject text,p_plan uuid,p_action text,
 p_expected integer default null,p_request uuid default null,p_digest text default null,
 p_payload jsonb default '{}'::jsonb,p_verifier text default null,p_credential jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.plan_shares; result jsonb; projection jsonb; member uuid;
begin
 if p_subject is null or length(p_subject) not between 1 and 200 then return jsonb_build_object('error','unavailable'); end if;
 perform 1 from public.dining_plans where id=p_plan and user_id=p_subject for update;
 if not found then return jsonb_build_object('error','unavailable'); end if;
 if p_action not in ('status','preview','retrieve','enable','disable','regenerate','title','label') or p_action is null then
 return jsonb_build_object('error','invalid'); end if;
 select * into r from private.plan_shares where plan_id=p_plan;
 if not found then
  r.plan_id:=p_plan; r.user_id:=p_subject; r.title:='Places to try'; r.enabled:=false; r.revision:=0;
 end if;
 if p_action not in ('status','preview','retrieve') then
  if p_expected is null or p_expected<0 or p_request is null or p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then
   return jsonb_build_object('error','invalid'); end if;
  if r.last_request=p_request then
   if r.last_digest<>p_digest then return jsonb_build_object('error','conflict'); end if;
  else
   if r.revision<>p_expected then return jsonb_build_object('error','conflict'); end if;
   if p_action in ('enable','regenerate') then
    projection:=private.sharing_projection(p_plan,r.title);
    if projection is null then return jsonb_build_object('error','ineligible'); end if;
    if p_action='regenerate' and not r.enabled then return jsonb_build_object('error','conflict'); end if;
    if not r.enabled or p_action='regenerate' then
     if p_verifier is null or p_verifier !~ '^[0-9a-f]{64}$' or p_credential is null
       or jsonb_typeof(p_credential)<>'object'
       or coalesce(p_credential->>'keyId','') !~ '^[A-Za-z0-9_-]{1,32}$'
       or coalesce(p_credential->>'nonce','') !~ '^[A-Za-z0-9_-]{16}$'
       or coalesce(p_credential->>'ciphertext','') !~ '^[A-Za-z0-9_-]{79}$' then
      return jsonb_build_object('error','invalid'); end if;
     r.enabled:=true; r.verifier:=p_verifier; r.credential:=p_credential; r.credential_revision:=p_expected+1;
    end if;
   elsif p_action='disable' then
    r.enabled:=false; r.verifier:=null; r.credential:=null; r.credential_revision:=null;
   elsif p_action='title' then
    if jsonb_typeof(p_payload->'title') is distinct from 'string'
      or char_length(btrim(p_payload->>'title')) not between 1 and 80 then return jsonb_build_object('error','invalid'); end if;
    r.title:=btrim(p_payload->>'title');
   elsif p_action='label' then
    if jsonb_typeof(p_payload->'name') is distinct from 'string'
      or char_length(btrim(p_payload->>'name')) not between 1 and 200
      or p_payload->>'provenance' is distinct from 'owner_authored'
      or (p_payload->'location' is not null and p_payload->'location'<>'null'::jsonb
        and (jsonb_typeof(p_payload->'location')<>'string' or char_length(btrim(p_payload->>'location')) not between 1 and 300)) then
      return jsonb_build_object('error','invalid'); end if;
    select id into member from public.dining_plan_items
     where plan_id=p_plan and user_id=p_subject and saved_place_id=p_payload->>'savedPlaceId' for update;
    if not found then return jsonb_build_object('error','unavailable'); end if;
    insert into private.plan_share_labels(member_id,name,location)
     values(member,btrim(p_payload->>'name'),btrim(p_payload->>'location'))
     on conflict(member_id) do update set name=excluded.name,location=excluded.location,updated_at=clock_timestamp();
   end if;
   r.revision:=r.revision+1; r.last_request:=p_request; r.last_digest:=p_digest; r.updated_at:=clock_timestamp();
   insert into private.plan_shares(plan_id,user_id,title,enabled,revision,verifier,credential,credential_revision,last_request,last_digest)
    values(p_plan,p_subject,r.title,r.enabled,r.revision,r.verifier,r.credential,r.credential_revision,r.last_request,r.last_digest)
    on conflict(plan_id) do update set title=excluded.title,enabled=excluded.enabled,revision=excluded.revision,
     verifier=excluded.verifier,credential=excluded.credential,credential_revision=excluded.credential_revision,
     last_request=excluded.last_request,last_digest=excluded.last_digest,updated_at=clock_timestamp();
   select * into r from private.plan_shares where plan_id=p_plan;
  end if;
 end if;
 result:=jsonb_build_object('enabled',r.enabled,'revision',r.revision,'title',r.title,
  'createdAt',r.created_at,'updatedAt',r.updated_at);
 if p_action='preview' then result:=result || jsonb_build_object('preview',private.sharing_projection(p_plan,r.title)); end if;
 if p_action in ('enable','regenerate','retrieve') and r.enabled then
  result:=result || jsonb_build_object('credential',r.credential,'credentialRevision',r.credential_revision,'verifier',r.verifier);
 end if;
 return result;
end $$;

create function private.read_shared_plan(p_verifier text)
returns jsonb language sql stable security definer set search_path='' as $$
 select private.sharing_projection(s.plan_id,s.title)
 from private.plan_shares s where s.enabled and s.verifier=p_verifier
$$;

-- Global bounds also bound row creation. No untrusted client IP header is used.
create function private.reserve_sharing(p_scope text,p_subject text default '',
 p_minute_cap integer default 120,p_day_cap integer default 5000)
returns boolean language plpgsql security definer set search_path='' as $$
declare minute bigint:=floor(extract(epoch from clock_timestamp())/60);
 day bigint:=floor(extract(epoch from clock_timestamp())/86400)*1440;
 bucket_value text; limit_value integer; window_value bigint; used integer;
begin
 if p_scope is null or p_scope not in ('public','owner') or p_subject is null or length(p_subject)>200
  or (p_scope='public' and p_subject<>'') or (p_scope='owner' and p_subject='')
  or p_minute_cap is null or p_minute_cap not between 0 and 120
  or p_day_cap is null or p_day_cap not between 0 and 5000 then return false; end if;
 perform pg_advisory_xact_lock(70900001);
 delete from private.sharing_usage where window_start<day-1440;
 for bucket_value,window_value,limit_value in
  select 'minute',minute,p_minute_cap union all select 'day',day,p_day_cap
  union all select 'owner:'||p_subject,minute,30 where p_scope='owner'
 loop
  select attempts into used from private.sharing_usage where scope=p_scope and bucket=bucket_value and window_start=window_value;
  if coalesce(used,0)>=limit_value then return false; end if;
 end loop;
 for bucket_value,window_value in
  select 'minute',minute union all select 'day',day
  union all select 'owner:'||p_subject,minute where p_scope='owner'
 loop
  insert into private.sharing_usage values(p_scope,bucket_value,window_value,1)
   on conflict(scope,bucket,window_start) do update set attempts=private.sharing_usage.attempts+1;
 end loop;
 return true;
end $$;

-- Public schema wrappers are invokers; only the server can execute either layer.
create function public.manage_plan_sharing(p_subject text,p_plan uuid,p_action text,
 p_expected integer default null,p_request uuid default null,p_digest text default null,
 p_payload jsonb default '{}'::jsonb,p_verifier text default null,p_credential jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$
 select private.manage_plan_sharing(p_subject,p_plan,p_action,p_expected,p_request,p_digest,p_payload,p_verifier,p_credential)
$$;
create function public.read_shared_plan(p_verifier text)
returns jsonb language sql security invoker set search_path='' as $$ select private.read_shared_plan(p_verifier) $$;
create function public.reserve_sharing(p_scope text,p_subject text default '',p_minute_cap integer default 120,p_day_cap integer default 5000)
returns boolean language sql security invoker set search_path='' as $$ select private.reserve_sharing(p_scope,p_subject,p_minute_cap,p_day_cap) $$;
revoke all on function private.sharing_projection(uuid,text) from public,anon,authenticated,service_role;
revoke all on function private.manage_plan_sharing(text,uuid,text,integer,uuid,text,jsonb,text,jsonb),
 public.manage_plan_sharing(text,uuid,text,integer,uuid,text,jsonb,text,jsonb),
 private.read_shared_plan(text),public.read_shared_plan(text),
 private.reserve_sharing(text,text,integer,integer),public.reserve_sharing(text,text,integer,integer)
 from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.manage_plan_sharing(text,uuid,text,integer,uuid,text,jsonb,text,jsonb),
 public.manage_plan_sharing(text,uuid,text,integer,uuid,text,jsonb,text,jsonb),
 private.read_shared_plan(text),public.read_shared_plan(text),
 private.reserve_sharing(text,text,integer,integer),public.reserve_sharing(text,text,integer,integer) to service_role;

create function private.delete_current_sharing_usage()
returns void language plpgsql security definer set search_path='' as $$
declare subject text:=nullif(auth.jwt()->>'sub','');
begin
 if subject is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(70900001);
 delete from private.sharing_usage where scope='owner' and bucket='owner:'||subject;
end $$;
revoke all on function private.delete_current_sharing_usage() from public,anon,service_role;
grant execute on function private.delete_current_sharing_usage() to authenticated;

create or replace function public.delete_current_user_data()
returns table(saved_places_deleted bigint,place_tags_deleted bigint) language plpgsql security invoker set search_path='' as $$
declare current_user_id text:=nullif(auth.jwt()->>'sub','');
begin
 if current_user_id is null then raise exception 'Authentication is required.'; end if;
 perform private.delete_current_sharing_usage();
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
