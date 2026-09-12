const path = require('path');
const assert = require('node:assert/strict');
// Optional pg dependency belongs in a temporary directory, never in the app.
// Run only against a disposable, migrated LOCAL PostgreSQL/Supabase database.
(async () => {
  const address = process.env.INBOX_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(address).hostname)) throw Error('Only a local database is permitted.');
  const { Client } = require(process.env.PG_MODULE || path.join(process.env.TEMP || '/tmp', 'lemonade-inbox-validation/node_modules/pg'));
  const clients = [new Client({ connectionString: address }), new Client({ connectionString: address })];
  const [first, second] = clients;
  const owner = 'inbox-concurrency-' + Date.now();
  const capture = async (client, urls) => (await client.query('select * from public.enqueue_import_inbox($1::text[], $2)', [urls, 'manual'])).rows;
  const count = async table => Number((await first.query(`select count(*) from public.${table}`)).rows[0].count);
  // Hold the first transaction open until PostgreSQL reports that the second
  // connection is actually waiting on its lock; mere Promise.all is not proof.
  async function race(operationA, operationB) {
    await first.query('begin');
    const a = await operationA();
    let settled = false;
    const pending = operationB().then(value => ({ value }), error => ({ error })).finally(() => { settled = true; });
    let blocked = false;
    try {
      for (let attempt = 0; attempt < 100 && !settled; attempt++) {
        const locks = await first.query('select cardinality(pg_blocking_pids($1)) > 0 as blocked', [second.processID]);
        if (locks.rows[0].blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.equal(blocked, true, 'second connection must wait for the first transaction');
    } finally { await first.query('commit'); }
    const b = await pending;
    if (b.error) throw b.error;
    return [a, b.value];
  }
  async function fill(amount) {
    for (let offset = 0; offset < amount; offset += 20) {
      await capture(first, Array.from({ length: Math.min(20, amount - offset) }, (_, i) => `https://www.instagram.com/p/fill${offset + i}/`));
    }
  }
  try {
    await Promise.all(clients.map(async client => {
      await client.connect();
      await client.query('set role authenticated');
      await client.query("set statement_timeout = '5s'");
      await client.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: owner, role: 'authenticated' })]);
    }));
    const duplicate = await race(() => capture(first, ['https://www.instagram.com/reel/same/']), () => capture(second, ['https://www.instagram.com/reel/same/']));
    assert.deepEqual(duplicate.flat().map(row => row.outcome), ['queued', 'already_queued']);
    await fill(98);
    const capacity = await race(() => capture(first, ['https://www.instagram.com/p/lastA/']), () => capture(second, ['https://www.instagram.com/p/lastB/']));
    assert.deepEqual(capacity.flat().map(row => row.outcome), ['queued', 'capacity_reached']);
    assert.equal(await count('import_inbox_items'), 100);
    console.log('PASS: overlapping duplicate capture and competing final-capacity RPCs');
    await first.query('delete from public.import_inbox_items');
    const url = 'https://www.instagram.com/p/cleanup/';
    await capture(first, [url]);
    const payload = { id: owner, name: 'Fixture', address: 'Fixture', areaOrCity: 'Fixture', category: 'cafe', providerPlaceId: owner };
    const save = async () => (await second.query('select * from public.save_place_with_source($1::jsonb, $2::jsonb)', [JSON.stringify(payload), JSON.stringify({ sourceUrl: url })])).rows[0];
    assert.equal((await save()).save_outcome, 'created_place');
    await first.query('begin');
    await first.query('select id from public.import_inbox_items for update');
    try {
      await second.query("set statement_timeout = '150ms'");
      await assert.rejects(second.query('delete from public.import_inbox_items'), error => error.code === '57014');
    } finally {
      await first.query('commit');
      await second.query("set statement_timeout = '5s'");
    }
    assert.equal(await count('saved_places'), 1);
    assert.equal(await count('saved_place_sources'), 1);
    assert.equal(await count('import_inbox_items'), 1);
    assert.equal((await save()).save_outcome, 'existing_source');
    await second.query('delete from public.import_inbox_items');
    assert.equal(await count('saved_places'), 1);
    assert.equal(await count('saved_place_sources'), 1);
    assert.equal(await count('import_inbox_items'), 0);
    console.log('PASS: forced cleanup timeout preserves saved place/source; retry removes inbox without duplicates');
  } finally {
    await Promise.all(clients.map(client => client.query('rollback').catch(() => {})));
    await first.query('select * from public.delete_current_user_data()').catch(() => {});
    await Promise.all(clients.map(client => client.end().catch(() => {})));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
