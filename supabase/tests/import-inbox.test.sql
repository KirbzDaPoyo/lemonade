begin;
set local plpgsql.check_asserts = on;
-- PGTAP_BEGIN
select plan(1);
-- PGTAP_END
set local role authenticated;
set local request.jwt.claims = '{"sub":"inbox-test-a","role":"authenticated"}';
do $test$
declare r record; item_id uuid; n integer; rejected boolean;
begin
  select * into r from public.enqueue_import_inbox(array['https://instagram.com/reels/one/?tracking=x'], 'share');
  assert r.outcome = 'queued', 'single capture';
  assert r.source_url = 'https://www.instagram.com/reel/one/', 'canonical identity';
  select * into r from public.enqueue_import_inbox(array['https://www.instagram.com/reel/one/#x'], 'manual');
  assert r.outcome = 'already_queued', 'duplicate capture';
  select count(*) into n from public.enqueue_import_inbox(array['https://instagram.com/reel/two/', 'https://www.instagram.com/reels/two/','invalid'], 'manual');
  assert n = 2, 'deduplicated batch with invalid result';
  assert (select count(*) from public.import_inbox_items) = 2, 'invalid not stored';
  select id into item_id from public.import_inbox_items where source_url = 'https://www.instagram.com/reel/one/';
  perform public.begin_inbox_attempt(item_id,'  Example hint  ');
  assert (select attempt_count = 1 and place_name_hint = 'Example hint' and last_attempt_at is not null from public.import_inbox_items where id = item_id), 'hint and attempt';
  update public.import_inbox_items set status = 'needs_attention', failure_category = 'network' where id = item_id;
  assert (select status = 'needs_attention' from public.import_inbox_items where id = item_id), 'attention';
  rejected := false;
  begin update public.import_inbox_items set failure_category = 'raw provider message' where id = item_id; exception when check_violation then rejected := true; end;
  assert rejected, 'failure allowlist';
  rejected := false;
  begin update public.import_inbox_items set attempt_count = -1 where id = item_id; exception when check_violation then rejected := true; end;
  assert rejected, 'attempt minimum';
  rejected := false;
  begin update public.import_inbox_items set attempt_count = 100001 where id = item_id; exception when check_violation then rejected := true; end;
  assert rejected, 'attempt maximum';
  rejected := false;
  begin update public.import_inbox_items set place_name_hint = repeat('x',201) where id = item_id; exception when check_violation then rejected := true; end;
  assert rejected, 'hint maximum';
  rejected := false;
  begin insert into public.import_inbox_items(user_id,source_url,origin) values ('inbox-test-b','https://www.instagram.com/p/cross/','share'); exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'cross-user insert';
  rejected := false;
  begin update public.import_inbox_items set user_id = 'inbox-test-b' where id = item_id; exception when insufficient_privilege then rejected := true; end;
  assert rejected, 'ownership update';
  rejected := false;
  begin perform public.enqueue_import_inbox(array_fill('https://www.instagram.com/p/x/'::text,array[21]),'manual'); exception when invalid_parameter_value then rejected := true; end;
  assert rejected, 'batch maximum';
  insert into public.import_inbox_items(source_url,origin) select 'https://www.instagram.com/p/cap' || i || '/', 'manual' from generate_series(1,98) i;
  select * into r from public.enqueue_import_inbox(array['https://instagram.com/p/overflow/'], 'manual');
  assert r.outcome = 'capacity_reached', 'RPC capacity';
  rejected := false;
  begin insert into public.import_inbox_items(source_url,origin) values ('https://www.instagram.com/p/bypass/','share'); exception when check_violation then rejected := true; end;
  assert rejected, 'direct capacity';
  assert (select count(*) from public.import_inbox_items) = 100, 'capacity unchanged';
end;
$test$;
set local request.jwt.claims = '{"sub":"inbox-test-b","role":"authenticated"}';
do $test$
declare n integer;
begin
  assert (select count(*) from public.import_inbox_items) = 0, 'cross-user select';
  update public.import_inbox_items set place_name_hint = 'attack' where user_id = 'inbox-test-a';
  get diagnostics n = row_count; assert n = 0, 'cross-user update';
  delete from public.import_inbox_items where user_id = 'inbox-test-a';
  get diagnostics n = row_count; assert n = 0, 'cross-user delete';
  perform public.enqueue_import_inbox(array['https://www.instagram.com/reel/one/'],'share');
  assert (select count(*) from public.import_inbox_items) = 1, 'per-user capacity and identity';
end;
$test$;
set local request.jwt.claims = '{"sub":"inbox-test-a","role":"authenticated"}';
do $test$
declare r record; payload jsonb := '{"id":"inbox-test-place","name":"Test","address":"Fixture","areaOrCity":"Fixture","category":"cafe","providerPlaceId":"inbox-test-provider"}';
begin
  delete from public.import_inbox_items;
  assert (select count(*) from public.import_inbox_items) = 0, 'clear own items';
  select * into r from public.save_place_with_source(payload, '{"sourceUrl":"https://www.instagram.com/p/saved1/"}');
  assert r.save_outcome = 'created_place', '0.4 save compatible';
  select * into r from public.save_place_with_source(payload, '{"sourceUrl":"https://www.instagram.com/p/saved2/"}');
  assert r.save_outcome = 'attached_source', 'attach compatible';
  select * into r from public.save_place_with_source(payload, '{"sourceUrl":"https://www.instagram.com/p/saved2/"}');
  assert r.save_outcome = 'existing_source', 'existing compatible';
  select * into r from public.enqueue_import_inbox(array['https://instagram.com/p/saved2/?tracking=x'],'share');
  assert r.outcome = 'already_saved' and r.saved_place_id = 'inbox-test-place', 'already saved';
  assert (select count(*) from public.import_inbox_items) = 0, 'saved not enqueued';
  perform public.enqueue_import_inbox(array['https://www.instagram.com/p/pending/'],'manual');
  delete from public.import_inbox_items;
  assert (select count(*) from public.saved_places) = 1, 'dismiss keeps place';
  assert (select count(*) from public.saved_place_sources) = 2, 'dismiss keeps sources';
  perform public.enqueue_import_inbox(array['https://www.instagram.com/p/pending/'],'manual');
  delete from public.saved_places;
  assert (select count(*) from public.import_inbox_items) = 1, 'place deletion keeps inbox';
  select * into r from public.delete_current_user_data();
  assert r.saved_places_deleted = 0, 'deletion signature compatible';
  assert (select count(*) from public.import_inbox_items) = 0, 'account deletion includes inbox';
end;
$test$;
set local request.jwt.claims = '{"sub":"inbox-test-b","role":"authenticated"}';
do $test$ begin assert (select count(*) from public.import_inbox_items) = 1, 'account deletion isolated'; end; $test$;
reset role;
do $test$
begin
  assert (select relrowsecurity from pg_class where oid='public.import_inbox_items'::regclass), 'RLS enabled';
  assert not has_table_privilege('anon','public.import_inbox_items','SELECT'), 'anonymous select revoked';
  assert not has_table_privilege('anon','public.import_inbox_items','INSERT'), 'anonymous insert revoked';
  assert not has_table_privilege('anon','public.import_inbox_items','UPDATE'), 'anonymous update revoked';
  assert not has_table_privilege('anon','public.import_inbox_items','DELETE'), 'anonymous delete revoked';
  assert has_table_privilege('authenticated','public.import_inbox_items','SELECT,INSERT,DELETE'), 'explicit table grants';
  assert has_column_privilege('authenticated','public.import_inbox_items','place_name_hint','UPDATE'), 'explicit hint grant';
  assert not has_column_privilege('authenticated','public.import_inbox_items','user_id','UPDATE'), 'immutable owner';
  assert not has_function_privilege('anon','public.enqueue_import_inbox(text[],text)','EXECUTE'), 'anonymous RPC revoked';
  assert has_function_privilege('authenticated','public.enqueue_import_inbox(text[],text)','EXECUTE'), 'authenticated RPC granted';
end;
$test$;
-- PGTAP_BEGIN
select pass('Inbox SQL assertions: capture, bounds, RLS, grants, save compatibility, deletion');
select * from finish();
-- PGTAP_END
rollback;
