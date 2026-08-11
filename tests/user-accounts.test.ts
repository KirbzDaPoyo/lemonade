import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { createSupabaseFetchWithJwtClockSkewRetry } from '../src/lib/supabaseClient';

const migration = readFileSync(
  resolve('.', 'supabase/migrations/20260810161421_add_user_accounts.sql'),
  'utf8'
);

test('Clerk ownership uses string subjects and per-user uniqueness', () => {
  assert.match(migration, /add column if not exists user_id text/i);
  assert.match(migration, /default \(auth\.jwt\(\)->>'sub'\)/i);
  assert.match(migration, /saved_places \(user_id, source_url\)/i);
  assert.match(migration, /place_tags \(user_id, lower\(btrim\(name\)\)\)/i);
  assert.doesNotMatch(migration, /references auth\.users/i);
});

test('legacy data remains available for an explicit administrative assignment', () => {
  assert.match(migration, /Legacy rows are assigned administratively/i);
  assert.doesNotMatch(migration, /security definer/i);
  assert.doesNotMatch(migration, /handle_new_user/i);
});

test('row-level security allows only authenticated Clerk subjects', () => {
  assert.match(migration, /revoke all on public\.saved_places from anon/i);
  assert.match(migration, /revoke all on public\.place_tags from anon/i);
  assert.match(migration, /to authenticated[\s\S]*auth\.jwt\(\)->>'sub'[\s\S]*user_id/i);
  assert.doesNotMatch(migration, /to anon\s+using \(true\)/i);
});

test('tag functions are scoped to the Clerk subject', () => {
  assert.match(migration, /current_user_id text := auth\.jwt\(\)->>'sub'/i);
  assert.match(migration, /saved_place\.user_id = current_user_id/i);
  assert.match(migration, /rename_place_tag\(uuid, text\) to authenticated/i);
  assert.match(migration, /delete_place_tag\(uuid\) to authenticated/i);
});

test('provider edge functions verify Clerk sessions in their handlers', () => {
  const sharedAuth = readFileSync(
    resolve('.', 'supabase/functions/_shared/clerkAuth.ts'),
    'utf8'
  );
  const instagramImport = readFileSync(
    resolve('.', 'supabase/functions/instagram-import/index.ts'),
    'utf8'
  );
  const placeSearch = readFileSync(
    resolve('.', 'supabase/functions/place-search/index.ts'),
    'utf8'
  );
  const supabaseConfig = readFileSync(resolve('.', 'supabase/config.toml'), 'utf8');

  assert.match(sharedAuth, /jwtVerify\(token, clerkJwks/);
  assert.match(sharedAuth, /payload\.role !== 'authenticated'/);
  assert.match(sharedAuth, /typeof payload\.sub !== 'string'/);
  assert.match(instagramImport, /await requireClerkUser\(req\)/);
  assert.match(placeSearch, /await requireClerkUser\(req\)/);
  assert.match(supabaseConfig, /\[functions\.instagram-import\][\s\S]*verify_jwt = false/);
  assert.match(supabaseConfig, /\[functions\.place-search\][\s\S]*verify_jwt = false/);
});


test('Supabase retries a future-issued JWT response once after clock skew settles', async () => {
  const responses = [
    new Response(JSON.stringify({ message: 'JWT issued at future' }), { status: 401 }),
    new Response(JSON.stringify({ data: [] }), { status: 200 })
  ];
  const delays: number[] = [];
  let requestCount = 0;
  const retryingFetch = createSupabaseFetchWithJwtClockSkewRetry(
    async () => responses[requestCount++]!,
    async (milliseconds) => {
      delays.push(milliseconds);
    }
  );

  const response = await retryingFetch('https://example.test/saved_places');

  assert.equal(response.status, 200);
  assert.equal(requestCount, 2);
  assert.deepEqual(delays, [1000]);
});

test('Supabase does not retry unrelated authentication failures', async () => {
  let requestCount = 0;
  const retryingFetch = createSupabaseFetchWithJwtClockSkewRetry(
    async () => {
      requestCount += 1;
      return new Response(JSON.stringify({ message: 'Invalid JWT' }), { status: 401 });
    },
    async () => {
      assert.fail('Unrelated authentication failures must not be delayed or retried.');
    }
  );

  const response = await retryingFetch('https://example.test/saved_places');

  assert.equal(response.status, 401);
  assert.equal(requestCount, 1);
});
