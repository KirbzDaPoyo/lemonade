begin;
set local lock_timeout='5s';
-- Explicit safe projection: credentials never enter an owner metadata/export response.
create function private.get_plan_sharing_details(p_plan uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('planId',p.id,'enabled',coalesce(s.enabled,false),'revision',coalesce(s.revision,0),
 'title',coalesce(s.title,'Places to try'),'createdAt',s.created_at,'updatedAt',s.updated_at,
 'labels',coalesce((select jsonb_agg(jsonb_build_object('savedPlaceId',i.saved_place_id,
 'name',l.name,'location',l.location,'updatedAt',l.updated_at) order by i.created_at,i.id)
 from public.dining_plan_items i left join private.plan_share_labels l on l.member_id=i.id
 where i.plan_id=p.id),'[]'::jsonb))
 from public.dining_plans p left join private.plan_shares s on s.plan_id=p.id
 where p.id=p_plan and p.user_id=nullif(auth.jwt()->>'sub','')
$$;
create function public.get_plan_sharing_details(p_plan uuid)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.get_plan_sharing_details(p_plan) $$;
create function private.get_plan_sharing_export_page(p_after uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(private.get_plan_sharing_details(x.plan_id) order by x.plan_id),'[]'::jsonb)
 from (select s.plan_id from private.plan_shares s where s.user_id=nullif(auth.jwt()->>'sub','')
 and (p_after is null or s.plan_id>p_after) order by s.plan_id limit 25) x
$$;
create function public.get_plan_sharing_export_page(p_after uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$ select private.get_plan_sharing_export_page(p_after) $$;
revoke all on function private.get_plan_sharing_details(uuid),public.get_plan_sharing_details(uuid),
 private.get_plan_sharing_export_page(uuid),public.get_plan_sharing_export_page(uuid) from public,anon,service_role;
grant usage on schema private to authenticated;
grant execute on function private.get_plan_sharing_details(uuid),public.get_plan_sharing_details(uuid),
 private.get_plan_sharing_export_page(uuid),public.get_plan_sharing_export_page(uuid) to authenticated;
-- Membership changes invalidate a previously reviewed sharing revision.
create function private.invalidate_plan_sharing_review()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 update private.plan_shares set revision=revision+1,last_request=null,last_digest=null,updated_at=clock_timestamp()
 where plan_id=case when TG_OP='DELETE' then OLD.plan_id else NEW.plan_id end;
 return null;
end $$;
revoke all on function private.invalidate_plan_sharing_review() from public,anon,authenticated,service_role;
create trigger invalidate_plan_sharing_review after insert or delete on public.dining_plan_items
 for each row execute function private.invalidate_plan_sharing_review();
commit;
notify pgrst,'reload schema';
