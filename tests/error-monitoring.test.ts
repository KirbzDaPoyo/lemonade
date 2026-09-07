import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adapter = readFileSync('src/observability/error-monitoring.ts', 'utf8');
const rootLayout = readFileSync('app/_layout.tsx', 'utf8');
const authenticatedLayout = readFileSync('app/(app)/_layout.tsx', 'utf8');
const addPlaceRoute = readFileSync('app/(app)/add-place.tsx', 'utf8');
const matchPlaceRoute = readFileSync('app/(app)/match-place.tsx', 'utf8');
const accountScreen = readFileSync('src/screens/AccountScreen.tsx', 'utf8');

test('Sentry stays disabled when no public DSN is configured', () => {
  assert.match(adapter, /if \(initialized \|\| !dsn\) return/);
  assert.match(adapter, /isConfigured: Boolean\(dsn\)/);
  assert.doesNotMatch(adapter, /ingest\.(?:us\.)?sentry\.io/);
});

test('paid and high-volume Sentry features remain disabled', () => {
  assert.match(adapter, /sendDefaultPii: false/);
  assert.match(adapter, /enableLogs: false/);
  assert.match(adapter, /tracesSampleRate: 0/);
  assert.match(adapter, /profilesSampleRate: 0/);
  assert.match(adapter, /replaysSessionSampleRate: 0/);
  assert.match(adapter, /replaysOnErrorSampleRate: 0/);
  assert.match(adapter, /beforeBreadcrumb: \(\) => null/);
});

test('beforeSend removes user-entered and authentication data', () => {
  const requiredSensitiveTerms = [
    'authorization',
    'token',
    'cookie',
    'email',
    'caption',
    'note',
    'source',
    'url',
    'query',
    'request',
    'response',
    'body',
    'place',
    'address'
  ];

  requiredSensitiveTerms.forEach((term) => {
    assert.match(adapter, new RegExp(term, 'i'));
  });
  assert.match(adapter, /delete scrubbed\.request/);
  assert.match(adapter, /delete scrubbed\.extra/);
  assert.match(adapter, /delete scrubbed\.breadcrumbs/);
  assert.match(adapter, /typeof userId === 'string' \? \{ id: userId \} : undefined/);
  assert.doesNotMatch(adapter, /setUser\(\{[^}]*email/i);
});

test('recovery boundaries cover the app, authenticated navigation, and import flow', () => {
  assert.match(rootLayout, /operation="app_frame"/);
  assert.match(authenticatedLayout, /operation="authenticated_navigation"/);
  assert.match(addPlaceRoute, /operation="import_flow"/);
  assert.match(matchPlaceRoute, /operation="import_flow"/);
});

test('monitoring context is limited to stable operation and category tags', () => {
  assert.match(adapter, /scope\.setTag\('operation'/);
  assert.match(adapter, /scope\.setTag\('category'/);
  assert.doesNotMatch(adapter, /scope\.setContext/);
  assert.doesNotMatch(adapter, /scope\.setExtra/);
});
test('non-production builds expose an explicit privacy-safe monitoring verification', () => {
  assert.match(adapter, /environment === 'production'/);
  assert.match(adapter, /Sentry\.flush\(\)/);
  assert.match(adapter, /monitoring_verification/);
  assert.match(accountScreen, /EXPO_PUBLIC_APP_ENV !== 'production'/);
  assert.match(accountScreen, /EXPO_PUBLIC_SENTRY_DSN/);
  assert.match(accountScreen, /VERIFY ERROR MONITORING/);
});