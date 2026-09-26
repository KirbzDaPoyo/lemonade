import process from 'node:process';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { VisitsRepository } from '../src/repositories/visits/visits-repository';
import type { Visit, VisitDraft } from '../src/types/visit';

async function main() {
  const base = process.env.VISITS_TEST_REST_URL!;
  const address = process.env.VISITS_TEST_DATABASE_URL!;
  const secret = process.env.VISITS_TEST_JWT_SECRET!;
  for (const url of [base, address]) assert.ok(url && ['localhost', '127.0.0.1'].includes(new URL(url).hostname), 'Disposable localhost only');
  assert.ok(secret?.length >= 32);
  const owner = 'visits-api-' + randomBytes(8).toString('hex'), stranger = owner + '-other';
  const token = (sub: string) => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 300 });
    return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
  };
  const api = (subject: string) => createClient(base, 'fixture-only', { accessToken: async () => token(subject),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(String(input).replace('/rest/v1/', '/'), init) } });
  const a = api(owner), b = api(stranger);
  const repo = new VisitsRepository(a, owner), other = new VisitsRepository(b, stranger);
  const { Client } = createRequire(import.meta.url)(path.join(tmpdir(), 'lemonade-inbox-validation/node_modules/pg'));
  const admin = new Client({ connectionString: address }); await admin.connect();
  try {
    for (const [client, sub] of [[a, owner], [b, stranger]] as const) {
      const result = await client.from('saved_places').insert({ id: sub, user_id: sub, name: 'Fixture', address: 'Test', area_or_city: 'Test', category: 'cafe', source_url: 'https://www.instagram.com/p/' + sub.replaceAll('-', '') + '/', status: 'visited' });
      assert.ifError(result.error);
    }
    const empty = await repo.history(owner); assert.equal(empty.summary.count, 0); assert.equal(empty.placeStatus, 'visited'); assert.equal(empty.summary.latestRated, null);
    assert.deepEqual(empty.entries, []);
    const draft: VisitDraft = { id: randomUUID(), visitDate: '2020-02-29', rating: 4, note: 'Private fixture' };
    const saved = await repo.save(owner, draft, 'Asia/Shanghai'); assert.equal(saved.id, draft.id); assert.equal(saved.note, draft.note);
    const duplicate = await repo.save(owner, draft, 'Asia/Shanghai'); assert.equal(duplicate.id, saved.id); assert.equal((await repo.history(owner)).summary.count, 1);
    const updated = await repo.save(owner, { ...draft, visitDate: '2020-02-28', rating: null, note: '' }, 'UTC', saved);
    assert.equal(updated.rating, null); assert.equal(updated.note, null); assert.equal(updated.visitDate, '2020-02-28');
    assert.equal((await repo.history(owner)).summary.latestRated, null);
    await repo.remove(owner, saved.id); await repo.remove(owner, saved.id);
    assert.equal((await repo.history(owner)).summary.count, 0); assert.equal((await repo.history(owner)).placeStatus, 'visited');
    console.log('PASS: actual Supabase client/PostgREST create, duplicate retry, edit, clear optional values, delete and empty history');

    for (let i = 0; i < 45; i++) await repo.save(owner, { id: randomUUID(), visitDate: `2020-03-${String(1 + Math.floor(i / 20)).padStart(2, '0')}`, rating: i === 0 ? 5 : null, note: i === 0 ? 'Oldest rated fixture' : '' }, 'UTC');
    // Controlled fixture ties prove the final UUID ordering without changing product triggers.
    await admin.query("set session_replication_role='replica'");
    try { await admin.query("update place_visits set created_at='2020-04-01T00:00:00.123456Z' where user_id=$1", [owner]); }
    finally { await admin.query("set session_replication_role='origin'"); }
    const expected = (await admin.query('select id from place_visits where user_id=$1 order by visit_date desc,created_at desc,id desc', [owner])).rows.map((r: { id: string }) => r.id);
    const seen: Visit[] = []; let cursor: Visit | undefined;
    do {
      const result = await repo.history(owner, cursor);
      assert.equal(result.summary.count, 45); assert.deepEqual(result.summary.latestRated, { rating: 5, visitDate: '2020-03-01' });
      assert.equal(result.summary.latestDate, '2020-03-03'); assert.ok(result.entries.length <= 20);
      seen.push(...result.entries);
      if (!result.hasMore) break;
      cursor = result.entries.at(-1)!;
      assert.match(cursor.createdAt, /123456/);
    } while (seen.length < 60);
    assert.deepEqual(seen.map(v => v.id), expected); assert.equal(new Set(seen.map(v => v.id)).size, 45);
    console.log('PASS: 45 visits over three bounded pages, date/timestamp/UUID ties, microsecond cursor and full-history latest rated summary');

    await assert.rejects(other.history(owner), /no longer available/);
    assert.equal((await other.history(stranger)).summary.count, 0);
    const forbidden = await b.from('place_visits').select('*').eq('saved_place_id', owner); assert.ifError(forbidden.error); assert.deepEqual(forbidden.data, []);
    const invalidCursor = await a.rpc('get_place_visit_history', { p_saved_place_id: owner, p_before_date: '2020-01-01' }); assert.equal(invalidCursor.error?.code, '22023');
    const anonymous = await fetch(base + '/rpc/get_place_visit_history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_saved_place_id: owner }) });
    assert.equal(anonymous.status, 401);
    await repo.remove(owner, seen[0].id); assert.equal((await repo.history(owner)).summary.count, 44);
    const newRated = seen.find(v => v.visitDate === '2020-03-03' && v.id !== seen[0].id)!;
    await repo.save(owner, { id: newRated.id, visitDate: '2020-03-04', rating: 2, note: 'Changed' }, 'UTC', newRated);
    assert.deepEqual((await repo.history(owner)).summary.latestRated, { rating: 2, visitDate: '2020-03-04' });
    assert.equal((await repo.history(owner)).entries[0].id, newRated.id);
    console.log('PASS: HTTP account isolation, anonymous rejection, cursor validation and summary/order recomputation after edits/deletes');
    const summaries = await repo.summaries([owner], () => {});
    assert.deepEqual(summaries[owner], { count: 44, latestDate: '2020-03-04', latestRating: 2 });
    const privateSummaries = await b.rpc('get_library_visit_summaries', { p_place_ids: [owner] });
    assert.ifError(privateSummaries.error); assert.deepEqual(privateSummaries.data, []);
    const oversized = await a.rpc('get_library_visit_summaries', { p_place_ids: Array(201).fill(owner) });
    assert.equal(oversized.error?.code, '22023');
    const anonSummary = await fetch(base + '/rpc/get_library_visit_summaries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_place_ids: [owner] }) });
    assert.equal(anonSummary.status, 401);
    await admin.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: owner })]);
    await admin.query(`insert into saved_places(id,user_id,name,address,area_or_city,category,source_url)
      select $1 || '-' || i,$1,'Export fixture','Test','Test','cafe','https://www.instagram.com/p/' || $1 || i || '/' from generate_series(1,405) i`, [owner]);
    console.log('PASS: owned summary values, anonymous rejection and bounded batch validation; 405 library fixtures ready');
    const ids = [owner, ...Array.from({ length: 405 }, (_, i) => owner + '-' + (i + 1))];
    const many = await repo.summaries(ids, () => {});
    assert.equal(Object.keys(many).length, 406); assert.equal(many[owner].count, 44);
    assert.deepEqual(many[owner + '-405'], { count: 0, latestDate: null, latestRating: null });
    console.log('PASS: 406 library summaries read across three batches');
    // Bulk fixture setup only: create/validation/lifecycle triggers are exercised above.
    // Avoid repeating time-zone catalog validation 1,007 times to test read pagination.
    await admin.query("set session_replication_role='replica'");
    try {
      await admin.query(`insert into place_visits(user_id,saved_place_id,visit_date,rating,note,validation_timezone)
        select $1,$1,'2019-01-01'::date,null,'私密 😀','Asia/Shanghai' from generate_series(1,1007)`, [owner]);
    } finally { await admin.query("set session_replication_role='origin'"); }
    console.log('Export fixtures ready; retrieving 1,051 visits');
    const exported = await repo.exportAll(() => {});
    const exportIds = (await admin.query('select id from place_visits where user_id=$1 order by id', [owner])).rows.map((r: { id: string }) => r.id);
    assert.equal(exported.length, 1051); assert.deepEqual(exported.map(v => v.id), exportIds);
    assert.equal(exported.filter(v => v.note === '私密 😀' && v.validationTimezone === 'Asia/Shanghai').length, 1007);
    assert.deepEqual(await other.exportAll(() => {}), []);
    await repo.remove(owner, newRated.id);
    assert.equal((await repo.summaries([owner], () => {}))[owner].latestRating, 5);
    console.log('PASS: 406 complete library summaries, ownership/anonymous/batch limits, latest-rated fallback and 1,051 complete private export records');
    const summarySecurity = (await admin.query("select prosecdef,provolatile,proconfig from pg_proc where proname='get_library_visit_summaries'")).rows[0];
    assert.equal(summarySecurity.prosecdef, false); assert.equal(summarySecurity.provolatile, 's'); assert.ok(summarySecurity.proconfig.includes('search_path=""'));
    const security = (await admin.query("select prosecdef,provolatile,proconfig from pg_proc where proname='get_place_visit_history'")).rows[0];
    assert.equal(security.prosecdef, false); assert.equal(security.provolatile, 's'); assert.ok(security.proconfig.includes('search_path=""'));
  } finally {
    await a.rpc('delete_current_user_data'); await b.rpc('delete_current_user_data'); await admin.end();
  }
}
main().catch(error => { console.error(error); throw error; });
