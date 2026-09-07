import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const html = readFileSync(resolve('.', 'web/index.html'), 'utf8');
const config = readFileSync(resolve('.', 'web/vercel.json'), 'utf8');

test('public deletion page documents the authenticated in-app flow', () => {
  assert.match(html, /sign in to the account you want to delete/i);
  assert.match(html, /Account/);
  assert.match(html, /Danger Zone/);
  assert.match(html, /type <strong>DELETE<\/strong>/i);
});

test('public deletion page explains scope, permanence, export, and verification', () => {
  assert.match(html, /Deletion is permanent/i);
  assert.match(html, /Saved places/);
  assert.match(html, /personal tag library/i);
  assert.match(html, /sign-in identity/i);
  assert.match(html, /Export My Data/i);
  assert.match(html, /email verification flow/i);
  assert.match(html, /never triggers deletion by itself/i);
});

test('public deletion surface contains no collection or tracking mechanisms', () => {
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /posthog|sentry/i);
  assert.doesNotMatch(html, /(?:src|href)=["']https?:/i);
  assert.match(config, /form-action 'none'/);
});
