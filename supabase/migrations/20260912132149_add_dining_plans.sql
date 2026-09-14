begin;
create table public.dining_plans (
 id uuid primary key default gen_random_uuid(), user_id text not null,
 title text not null check (title = btrim(title) and char_length(title) between 1 and 80),
 status text not null default 'active' check (status in ('active','completed')),
 completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (id,user_id), check ((status = 'active' and completed_at is null) or (status = 'completed' and completed_at is not null))
);
create index dining_plans_owner_order on public.dining_plans(user_id,status,updated_at desc,id);
create table public.dining_plan_items (
 id uuid primary key default gen_random_uuid(), user_id text not null, plan_id uuid not null, saved_place_id text not null, created_at timestamptz not null default now(),
 foreign key (plan_id,user_id) references public.dining_plans(id,user_id) on delete cascade,
 foreign key (saved_place_id,user_id) references public.saved_places(id,user_id) on delete cascade,
 unique(plan_id,saved_place_id)
);
create index dining_plan_items_owner on public.dining_plan_items(user_id);
create index dining_plan_items_saved_place_owner on public.dining_plan_items(saved_place_id,user_id);
alter table public.dining_plans enable row level security;
alter table public.dining_plan_items enable row level security;
revoke all on public.dining_plans,public.dining_plan_items from public,anon,authenticated;
grant select,delete on public.dining_plans to authenticated;
grant insert(id,user_id,title),update(title,status) on public.dining_plans to authenticated;
grant select,delete on public.dining_plan_items to authenticated;
grant insert(user_id,plan_id,saved_place_id) on public.dining_plan_items to authenticated;
create policy plans_select on public.dining_plans for select to authenticated using(user_id=((select auth.jwt())->>'sub'));
create policy plans_insert on public.dining_plans for insert to authenticated with check(user_id=((select auth.jwt())->>'sub'));
create policy plans_update on public.dining_plans for update to authenticated using(user_id=((select auth.jwt())->>'sub')) with check(user_id=((select auth.jwt())->>'sub'));
create policy plans_delete on public.dining_plans for delete to authenticated using(user_id=((select auth.jwt())->>'sub'));
create policy items_select on public.dining_plan_items for select to authenticated using(user_id=((select auth.jwt())->>'sub'));
create policy items_insert on public.dining_plan_items for insert to authenticated with check(user_id=((select auth.jwt())->>'sub'));
create policy items_delete on public.dining_plan_items for delete to authenticated using(user_id=((select auth.jwt())->>'sub'));
create function public.guard_dining_plan() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.user_id is distinct from nullif(auth.jwt()->>'sub','') then raise exception 'Ownership rejected' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.user_id<>old.user_id or new.id<>old.id) then raise exception 'Identity immutable' using errcode='42501'; end if;
 new.title:=btrim(new.title); new.updated_at:=clock_timestamp();
 if new.status='active' then new.completed_at:=null;
 elsif tg_op='INSERT' then new.completed_at:=clock_timestamp();
 elsif old.status<>new.status then new.completed_at:=clock_timestamp(); end if;
 return new;
end $$;
create trigger guard_dining_plan before insert or update on public.dining_plans for each row execute function public.guard_dining_plan();
create function public.guard_dining_plan_item() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.user_id is distinct from nullif(auth.jwt()->>'sub','') then raise exception 'Ownership rejected' using errcode='42501'; end if;
 -- Serialize even direct Data API inserts. Updating the parent also produces a
 -- write conflict under repeatable-read instead of admitting a stale count.
 update public.dining_plans set title=title where id=new.plan_id and user_id=new.user_id;
 if not found then raise exception 'Plan unavailable' using errcode='23503'; end if;
 if exists(select 1 from public.dining_plan_items where plan_id=new.plan_id and saved_place_id=new.saved_place_id) then raise exception 'Duplicate membership' using errcode='23505'; end if;
 if (select count(*) from public.dining_plan_items where plan_id=new.plan_id)>=20 then raise exception 'Plan full' using errcode='P0020'; end if;
 return new;
end $$;
create trigger guard_dining_plan_item before insert on public.dining_plan_items for each row execute function public.guard_dining_plan_item();
revoke all on function public.guard_dining_plan(), public.guard_dining_plan_item() from public,anon;
grant execute on function public.guard_dining_plan(), public.guard_dining_plan_item() to authenticated;
create or replace function public.delete_current_user_data()
returns table(saved_places_deleted bigint,place_tags_deleted bigint) language plpgsql security invoker set search_path='' as $$
declare current_user_id text:=nullif(auth.jwt()->>'sub','');
begin
 if current_user_id is null then raise exception 'Authentication is required.'; end if;
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
