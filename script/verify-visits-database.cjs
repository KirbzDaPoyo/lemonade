// Runs only against an explicitly supplied disposable localhost database.
// The Windows launcher applies the entire migration chain before calling this.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
(async () => {
  const address = process.env.VISITS_TEST_DATABASE_URL;
  if (!address || !['127.0.0.1', 'localhost'].includes(new URL(address).hostname)) throw Error('Disposable localhost database required');
  const { Client } = require(process.env.VISITS_PG_MODULE || path.join(os.tmpdir(), 'lemonade-inbox-validation/node_modules/pg'));
  const [admin, a, b, other, anonymous] = Array.from({ length: 5 }, () => new Client({ connectionString: address }));
  const owner = 'visits-a-' + randomUUID(), stranger = 'visits-b-' + randomUUID();
  const place = owner + '-place', secondPlace = owner + '-second', foreignPlace = stranger + '-place';
  const q = (client, sql, params = []) => client.query(sql, params);
  const denied = (promise, code) => assert.rejects(promise, e => e.code === code);
  const create = (client, id, savedPlace = place, date = '2020-02-29', zone = 'Asia/Shanghai', rating = null, note = null) =>
    q(client, 'select * from public.create_place_visit($1,$2,$3,$4,$5,$6)', [id, savedPlace, date, zone, rating, note]);
  const count = async () => Number((await q(a, 'select count(*) from place_visits')).rows[0].count);
  const status = async (id = place) => (await q(a, 'select status from saved_places where id=$1', [id])).rows[0]?.status;
  const addPlace = (client, id, sub) => q(client, `insert into saved_places(id,user_id,name,address,area_or_city,category,source_url)
    values($1,$2,'Fixture','Test','Test','cafe',$3)`, [id, sub, 'https://www.instagram.com/p/' + id.replaceAll('-', '') + '/']);
  try {
    await Promise.all([admin, a, b, other, anonymous].map(c => c.connect()));
    for (const [client, sub] of [[a, owner], [b, owner], [other, stranger]]) {
      await q(client, 'set role authenticated');
      await q(client, "select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub })]);
      await q(client, "set statement_timeout='8s'");
    }
    await q(anonymous, 'set role anon');
    await addPlace(a, place, owner); await addPlace(a, secondPlace, owner); await addPlace(other, foreignPlace, stranger);
    const id = randomUUID();
    await create(a, id);
    assert.equal(await status(), 'visited'); assert.equal(await count(), 1);
    const original = (await q(a, 'select visit_date::text,rating,note,created_at,updated_at from place_visits where id=$1', [id])).rows[0];
    assert.equal(original.visit_date, '2020-02-29'); assert.equal(original.rating, null); assert.equal(original.note, null);
    await create(a, id); assert.equal(await count(), 1);
    await create(a, randomUUID()); assert.equal(await count(), 2);
    await q(a, "update saved_places set status='skipped' where id=$1", [place]);
    await create(a, id); assert.equal(await status(), 'skipped');
    await q(a, "update place_visits set rating=5,note='Edited',visit_date='2020-03-01' where id=$1", [id]);
    const retried = (await create(a, id)).rows[0];
    assert.equal(Number(retried.rating), 5); assert.equal(retried.note, 'Edited'); assert.equal(await status(), 'skipped');
    assert.equal(retried.created_at.getTime(), original.created_at.getTime());
    assert.ok(retried.updated_at.getTime() >= original.updated_at.getTime());
    await denied(create(a, id, secondPlace), '22023');
    await q(a, 'update place_visits set rating=null,note=null where id=$1', [id]);
    assert.equal((await create(a, id)).rows[0].rating, null);
    console.log('PASS: optional fields, repeated/same-day visits, retry identity, edits and manual lifecycle independence');

    assert.equal((await q(other, 'select * from place_visits where user_id=$1', [owner])).rowCount, 0);
    for (const sql of ['update place_visits set rating=1 where id=$1', 'delete from place_visits where id=$1']) assert.equal((await q(other, sql, [id])).rowCount, 0);
    await denied(create(other, randomUUID(), place), '23503');
    await denied(q(a, `insert into place_visits(user_id,saved_place_id,visit_date,validation_timezone)
      values($1,$2,'2020-01-01','UTC')`, [stranger, foreignPlace]), '42501');
    await denied(create(a, randomUUID(), foreignPlace), '23503');
    await denied(create(a, randomUUID(), 'missing'), '23503');
    for (const sql of ["update place_visits set user_id='forged'", 'update place_visits set id=gen_random_uuid()',
      'update place_visits set saved_place_id=saved_place_id', 'update place_visits set created_at=now()', 'update place_visits set updated_at=now()',
      "insert into place_visits(user_id,saved_place_id,visit_date,validation_timezone,created_at) values('x','x','2020-01-01','UTC',now())"])
      await denied(q(a, sql), '42501');
    for (const sql of ['select * from place_visits', 'insert into place_visits default values', 'update place_visits set rating=1', 'delete from place_visits']) await denied(q(anonymous, sql), '42501');
    await denied(create(anonymous, randomUUID()), '42501');
    await q(b, "select set_config('request.jwt.claims','{}',false)");
    await denied(create(b, randomUUID()), '42501');
    assert.equal((await q(b, 'select * from place_visits')).rowCount, 0);
    await q(b, "select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: owner })]);
    // Submission IDs are scoped to the owner; a different owner cannot claim a row.
    await create(other, id, foreignPlace); assert.equal((await q(other, 'select * from place_visits')).rowCount, 1);
    console.log('PASS: anonymous/missing-identity denial, cross-account CRUD/link protections and immutable identities/timestamps');

    const before = await count();
    await denied(create(a, null), '22023');
    await denied(create(a, randomUUID(), place, null), '23502');
    for (const date of ['2023-02-29', '2020-13-01']) await denied(create(a, randomUUID(), place, date), '22008');
    for (const date of ['infinity', '-infinity', '10000-01-01']) await assert.rejects(create(a, randomUUID(), place, date));
    for (const rating of [0, 6, 1.5, 'NaN', 'Infinity']) await denied(create(a, randomUUID(), place, '2020-01-01', 'UTC', rating), '23514');
    for (const zone of ['Not/AZone', 'UTC+99', '', null]) await denied(create(a, randomUUID(), place, '2020-01-01', zone), '22023');
    await denied(create(a, randomUUID(), place, '2020-01-01', 'UTC', null, '😀'.repeat(2001)), '23514');
    assert.equal(await count(), before); assert.equal(await status(), 'skipped');
    const limitId = randomUUID();
    await create(a, limitId, place, '2020-01-01', 'UTC', 1, '😀'.repeat(2000));
    await denied(q(a, 'update place_visits set rating=2.5 where id=$1', [limitId]), '23514');
    await denied(q(a, 'update place_visits set note=$1 where id=$2', ['界'.repeat(2001), limitId]), '23514');
    assert.equal(Number((await q(a, 'select rating from place_visits where id=$1', [limitId])).rows[0].rating), 1);
    console.log('PASS: valid leap dates, required date, integer rating bounds, Unicode note limit and rejected-mutation rollback');

    // UTC+14 and UTC-12 always exercise different local days, regardless of run time.
    for (const zone of ['Pacific/Kiritimati', 'Etc/GMT+12', 'Asia/Shanghai', 'America/New_York']) {
      const dates = (await q(admin, `select (statement_timestamp() at time zone $1)::date::text as today,
        ((statement_timestamp() at time zone $1)::date+1)::text as tomorrow`, [zone])).rows[0];
      const localId = randomUUID(); await create(a, localId, place, dates.today, zone);
      await denied(create(a, randomUUID(), place, dates.tomorrow, zone), '22023');
      await q(a, "set timezone='America/Los_Angeles'");
      assert.equal((await q(a, 'select visit_date::text from place_visits where id=$1', [localId])).rows[0].visit_date, dates.today);
      await denied(q(a, 'update place_visits set visit_date=$1 where id=$2', [dates.tomorrow, localId]), '22023');
      // Travel may change validation context, never the recorded day.
      await q(a, "update place_visits set validation_timezone='Etc/GMT+12',note='After travelling' where id=$1", [localId]);
      assert.equal((await q(a, 'select visit_date::text from place_visits where id=$1', [localId])).rows[0].visit_date, dates.today);
    }
    console.log('PASS: local today/future-date boundaries across time zones and date preservation after travel');

    // Inject failures on both sides of the atomic lifecycle operation.
    await q(admin, `create function public.visits_test_fail_status() returns trigger language plpgsql as $$
      begin if new.id like '%-second' and new.status='visited' then raise exception 'Fixture failure'; end if; return new; end $$;
      create trigger visits_test_fail_status before update on saved_places for each row execute function public.visits_test_fail_status()`);
    const failedId = randomUUID();
    await denied(create(a, failedId, secondPlace), 'P0001');
    assert.equal((await q(a, 'select * from place_visits where id=$1', [failedId])).rowCount, 0);
    assert.equal(await status(secondPlace), 'want_to_go');
    await q(admin, 'drop trigger visits_test_fail_status on saved_places; drop function visits_test_fail_status()');
    await q(admin, `create function public.visits_test_fail_insert() returns trigger language plpgsql as $$
      begin raise exception 'Fixture failure'; end $$;
      create trigger zz_visits_test_fail_insert after insert on place_visits for each row execute function public.visits_test_fail_insert()`);
    await denied(create(a, failedId, secondPlace), 'P0001');
    assert.equal(await status(secondPlace), 'want_to_go');
    await q(admin, 'drop trigger zz_visits_test_fail_insert on place_visits; drop function visits_test_fail_insert()');
    await create(a, failedId, secondPlace); assert.equal(await status(secondPlace), 'visited');
    await q(a, 'delete from place_visits where id=$1', [failedId]); assert.equal(await status(secondPlace), 'visited');
    // Direct writes receive the same atomic behavior as RPC callers.
    await q(a, "update saved_places set status='skipped' where id=$1", [secondPlace]);
    await q(a, `insert into place_visits(user_id,id,saved_place_id,visit_date,validation_timezone)
      values($1,$2,$3,'2020-01-01','UTC')`, [owner, failedId, secondPlace]);
    assert.equal(await status(secondPlace), 'visited');
    await q(a, "update saved_places set status='want_to_go' where id=$1", [secondPlace]);
    await q(a, `insert into place_visits(user_id,id,saved_place_id,visit_date,validation_timezone)
      values($1,$2,$3,'2020-01-01','UTC') on conflict(user_id,id) do nothing`, [owner, failedId, secondPlace]);
    assert.equal(await status(secondPlace), 'want_to_go');
    console.log('PASS: injected lifecycle/insert failures roll back both writes; successful retry and direct-write consistency');

    async function overlap(firstAction, secondAction, isolation = 'read committed') {
      await q(a, 'begin isolation level ' + isolation); await firstAction();
      await q(b, 'begin isolation level ' + isolation);
      let settled = false;
      const pending = secondAction().then(value => ({ value }), error => ({ error })).finally(() => { settled = true; });
      let blocked = false;
      for (let i = 0; i < 150 && !settled; i++) {
        if ((await q(admin, 'select cardinality(pg_blocking_pids($1))>0 as blocked', [b.processID])).rows[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      await q(a, 'commit'); const result = await pending;
      await q(b, result.error ? 'rollback' : 'commit');
      assert.ok(blocked, 'requests must provably overlap'); return result;
    }
    const concurrentId = randomUUID();
    const race = await overlap(() => create(a, concurrentId), () => create(b, concurrentId));
    assert.ifError(race.error); assert.equal(race.value.rows[0].id, concurrentId);
    assert.equal((await q(a, 'select * from place_visits where id=$1', [concurrentId])).rowCount, 1);
    const repeatableId = randomUUID();
    const conflict = await overlap(() => create(a, repeatableId), () => create(b, repeatableId), 'repeatable read');
    assert.equal(conflict.error?.code, '40001'); await create(b, repeatableId);
    assert.equal((await q(a, 'select * from place_visits where id=$1', [repeatableId])).rowCount, 1);
    console.log('PASS: proven overlapping duplicate submissions and repeatable-read conflict/retry produce one entry');

    await q(a, 'delete from saved_places where id=$1', [secondPlace]);
    assert.equal((await q(a, 'select * from place_visits where saved_place_id=$1', [secondPlace])).rowCount, 0);
    const deletionRace = await overlap(() => q(a, 'select * from delete_current_user_data()'), () => create(b, randomUUID()));
    assert.equal(deletionRace.error?.code, '23503'); assert.equal(await count(), 0);
    assert.equal((await q(a, 'select * from saved_places')).rowCount, 0);
    assert.equal((await q(other, 'select * from place_visits')).rowCount, 1);
    assert.equal((await q(other, 'select * from saved_places')).rowCount, 1);
    console.log('PASS: place/account deletion cascades, concurrent create cannot revive deleted places, other account retained');

    const security = (await q(admin, "select relrowsecurity from pg_class where oid='public.place_visits'::regclass")).rows[0];
    assert.equal(security.relrowsecurity, true);
    const functions = (await q(admin, `select proname,prosecdef,proconfig from pg_proc
      where proname in ('guard_place_visit','mark_place_visited_after_insert','create_place_visit')`)).rows;
    assert.equal(functions.length, 3);
    assert.ok(functions.every(f => !f.prosecdef && f.proconfig.includes('search_path=""')));
    const policy = (await q(admin, "select qual,with_check from pg_policies where tablename='place_visits' and cmd='UPDATE'")).rows[0];
    assert.ok(policy.qual.includes('user_id') && policy.with_check.includes('user_id'));
    assert.equal((await q(admin, "select count(*) from pg_indexes where tablename='place_visits'")).rows[0].count, '3');
    console.log('PASS: RLS, explicit grants, ownership checks, invoker-only functions and history indexes');
  } finally {
    await Promise.all([admin, a, b, other, anonymous].map(c => c.end()));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
