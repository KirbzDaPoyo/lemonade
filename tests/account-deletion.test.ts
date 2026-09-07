import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const migrationName = readdirSync(resolve('.', 'supabase/migrations')).find((name) =>
  name.endsWith('_delete_current_user_data.sql')
);

assert.ok(migrationName, 'Account deletion migration must exist.');
const migration = readFileSync(resolve('.', 'supabase/migrations', migrationName), 'utf8');

test('account deletion RPC accepts no user identifier', () => {
  assert.match(migration, /delete_current_user_data\(\)/i);
  assert.doesNotMatch(migration, /delete_current_user_data\([^)]*(?:user|subject|owner|id)[^)]*\)/i);
});

test('account deletion derives ownership only from the authenticated JWT subject', () => {
  assert.match(migration, /current_user_id text := nullif\(auth\.jwt\(\)->>'sub', ''\)/i);
  assert.match(migration, /if current_user_id is null then[\s\S]*Authentication is required/i);
  assert.match(migration, /delete from public\.saved_places\s+where user_id = current_user_id/i);
  assert.match(migration, /delete from public\.place_tags\s+where user_id = current_user_id/i);
  assert.doesNotMatch(migration, /where user_id\s*(?:<>|!=|is distinct from)/i);
});

test('account deletion uses invoker privileges and authenticated-only execution', () => {
  assert.match(migration, /security invoker/i);
  assert.doesNotMatch(migration, /security definer/i);
  assert.match(migration, /revoke all on function public\.delete_current_user_data\(\) from public/i);
  assert.match(migration, /revoke all on function public\.delete_current_user_data\(\) from anon/i);
  assert.match(migration, /revoke all on function public\.delete_current_user_data\(\) from service_role/i);
  assert.match(migration, /grant execute on function public\.delete_current_user_data\(\) to authenticated/i);
});

test('account deletion returns only non-sensitive deletion counts', () => {
  assert.match(migration, /saved_places_deleted bigint/i);
  assert.match(migration, /place_tags_deleted bigint/i);
  const returnColumns = migration.match(/returns table \(([^)]*)\)/i)?.[1] ?? '';

  assert.doesNotMatch(returnColumns, /(?:email|user_id|subject|token)/i);
});

test('client deletion validates a fresh session before deleting database data', () => {
  const screen = readFileSync(resolve('.', 'src/screens/AccountScreen.tsx'), 'utf8');
  const handler = screen.match(/const handleDeleteAccount[\s\S]*?const closeDeletion/)?.[0] ?? '';

  assert.match(handler, /getToken\(\{ skipCache: true \}\)/);
  assert.match(handler, /if \(!freshAccessToken\)[\s\S]*throw new Error/);
  assert.match(handler, /deleteCurrentUserData\(freshAccessToken\)/);
  assert.match(handler, /await finishIdentityDeletion\(\)/);
  assert.ok(handler.indexOf('deleteCurrentUserData') < handler.indexOf('finishIdentityDeletion'));
});

test('identity and local state are cleared only after Clerk deletion succeeds', () => {
  const screen = readFileSync(resolve('.', 'src/screens/AccountScreen.tsx'), 'utf8');
  const finisher = screen.match(/const finishIdentityDeletion[\s\S]*?const handleDeleteAccount/)?.[0] ?? '';

  assert.match(finisher, /await user\.delete\(\)/);
  assert.match(finisher, /setDeletionPhase\('partial'\)/);
  assert.match(finisher, /analytics\.reset\(\)/);
  assert.match(finisher, /errorMonitoring\.resetIdentity\(\)/);
  assert.match(finisher, /clearLocalData\(\)/);
  assert.ok(finisher.indexOf('await user.delete()') < finisher.indexOf('analytics.reset()'));
});
