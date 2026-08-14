import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  boundAnalyticsCandidateRank,
  boundAnalyticsResultCount,
  normalizeAnalyticsEnvironment,
  normalizeAnalyticsFailureCategory
} from '../src/observability/analytics-contract';

test('analytics environment is restricted to the approved release stages', () => {
  assert.equal(normalizeAnalyticsEnvironment('development', false), 'development');
  assert.equal(normalizeAnalyticsEnvironment('preview', true), 'preview');
  assert.equal(normalizeAnalyticsEnvironment('production', true), 'production');
  assert.equal(normalizeAnalyticsEnvironment('anything-else', true), 'development');
  assert.equal(normalizeAnalyticsEnvironment(undefined, false), 'preview');
});

test('provider failures are reduced to bounded categories instead of raw errors', () => {
  const cases: Array<[unknown, string]> = [
    [new Error('This Instagram post is private'), 'private_post'],
    [new Error('Unsupported Instagram URL'), 'unsupported_url'],
    [new Error('Provider returned 429'), 'rate_limited'],
    [new Error('Network request timed out'), 'network'],
    [new Error("Couldn't identify a matching place"), 'no_match'],
    [new Error('Apify provider is unavailable'), 'provider_unavailable'],
    [new Error('Sensitive internal response'), 'unexpected'],
    [{ message: 'not an Error instance' }, 'unexpected']
  ];

  cases.forEach(([error, category]) => {
    assert.equal(normalizeAnalyticsFailureCategory(error), category);
  });
});

test('candidate counts and ranks stay within the analytics contract', () => {
  assert.equal(boundAnalyticsResultCount(-5), 0);
  assert.equal(boundAnalyticsResultCount(7.8), 7);
  assert.equal(boundAnalyticsResultCount(200), 20);
  assert.equal(boundAnalyticsResultCount(Number.NaN), 0);

  assert.equal(boundAnalyticsCandidateRank(-5), 1);
  assert.equal(boundAnalyticsCandidateRank(4.9), 4);
  assert.equal(boundAnalyticsCandidateRank(200), 20);
  assert.equal(boundAnalyticsCandidateRank(Number.NaN), 1);
});

test('analytics adapter does not declare sensitive product properties', () => {
  const adapter = readFileSync('src/observability/analytics.ts', 'utf8');
  const forbiddenProperties = [
    'email',
    'caption',
    'notes',
    'source_url',
    'search_text',
    'address',
    'place_name',
    'raw_error',
    'token'
  ];

  forbiddenProperties.forEach((property) => {
    assert.doesNotMatch(adapter, new RegExp(`["']${property}["']\\s*:`, 'i'));
  });
});
