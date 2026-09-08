import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const workflow = readFileSync(resolve('.', '.github/workflows/ci.yml'), 'utf8');

test('CI validates locked dependencies, tests, and TypeScript', () => {
  assert.match(workflow, /push:/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run typecheck/);
});

test('CI cannot consume EAS builds, deploy, or use application secrets', () => {
  assert.doesNotMatch(workflow, /eas\s+build|eas\s+workflow|deploy/i);
  assert.doesNotMatch(workflow, /secrets\./i);
  assert.doesNotMatch(workflow, /EXPO_PUBLIC_|SUPABASE_|CLERK_|POSTHOG_|SENTRY_/);
});
