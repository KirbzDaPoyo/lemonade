import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { InboxRepository } from '../src/repositories/inbox/inbox-repository';

// Run against disposable local PostgREST, with a test-only signing key supplied
// by the isolated runner. Never accepts a hosted URL or a real user token.
async function main() {
  const base = process.env.INBOX_TEST_REST_URL!;
  const secret = process.env.INBOX_TEST_JWT_SECRET!;
  assert.ok(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  assert.ok(secret?.length >= 32);
  const ownerA = 'api-a-' + randomBytes(8).toString('hex');
  const ownerB = 'api-b-' + randomBytes(8).toString('hex');
  function token(sub: string, extra = {}, signingKey = secret) {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 300, ...extra });
    return body + '.' + createHmac('sha256', signingKey).update(body).digest('base64url');
  }
  const api = (jwt: string) => createClient(base, 'local-fixture', {
    accessToken: async () => jwt,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Standalone PostgREST has no Supabase gateway prefix.
    global: { fetch: (input, init) => fetch(String(input).replace('/rest/v1/', '/'), init) }
  });
  const a = api(token(ownerA));
  const b = api(token(ownerB));
  const repoA = new InboxRepository(a, ownerA);
  const repoB = new InboxRepository(b, ownerB);
  const url = 'https://www.instagram.com/reel/apifixture/';
  try {
    for (const jwt of ['', token(ownerA, { exp: 1 }), token(ownerA, {}, 'invalid-signature-key-for-testing-only')]) {
      const response = await fetch(base + '/import_inbox_items?select=id', { headers: jwt ? { Authorization: 'Bearer ' + jwt } : {} });
      assert.equal(response.status, 401);
    }
    console.log('PASS: HTTP rejects anonymous, expired and incorrectly signed access tokens');
    assert.equal((await repoA.enqueue([url], 'share'))[0].outcome, 'queued');
    assert.equal((await repoA.enqueue([url], 'share'))[0].outcome, 'already_queued');
    const item = (await repoA.list())[0];
    assert.equal(item.sourceUrl, url);
    assert.deepEqual(await repoB.list(), []);
    const unfiltered = await b.from('import_inbox_items').select('*');
    assert.equal(unfiltered.error, null);
    assert.deepEqual(unfiltered.data, []);
    const deniedUpdate = await b.from('import_inbox_items').update({ place_name_hint: 'other owner' }).eq('id', item.id).select();
    assert.equal(deniedUpdate.error, null);
    assert.deepEqual(deniedUpdate.data, []);
    const deniedDelete = await b.from('import_inbox_items').delete().eq('id', item.id).select();
    assert.equal(deniedDelete.error, null);
    assert.deepEqual(deniedDelete.data, []);
    const forged = await b.from('import_inbox_items').insert({ user_id: ownerA, source_url: 'https://www.instagram.com/p/forged/', origin: 'manual' });
    assert.ok(forged.error);
    const ownerChange = await a.from('import_inbox_items').update({ user_id: ownerB }).eq('id', item.id);
    assert.ok(ownerChange.error);
    await repoA.updateHint(item.id, '  Saved API hint  ');
    await repoA.beginAttempt(item.id, 'Saved API hint');
    await repoA.markAttention(item.id, 'network');
    const updated = (await repoA.list())[0];
    assert.equal(updated.placeNameHint, 'Saved API hint');
    assert.equal(updated.attemptCount, 1);
    assert.equal(updated.status, 'needs_attention');
    await repoA.beginAttempt(item.id, 'Retry');
    assert.equal((await repoA.list())[0].status, 'pending');
    assert.equal((await repoB.enqueue([url], 'manual'))[0].outcome, 'queued');
    assert.equal((await repoB.list()).length, 1);
    await repoA.remove(item.id);
    assert.deepEqual(await repoA.list(), []);
    assert.equal((await repoB.list()).length, 1);
    console.log('PASS: real Supabase client/repository CRUD, RPC, hints, attempts and retry over HTTP');
    console.log('PASS: two signed identities cannot read, change, delete or insert another owner’s inbox data');
  } finally {
    await repoA.clear();
    await repoB.clear();
  }
  console.log('LIMIT: local fixture signing verifies PostgREST authentication; hosted Clerk issuance/session verification requires device acceptance.');
}
void main();
