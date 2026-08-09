import assert from 'node:assert/strict';
import test from 'node:test';

import { extractInstagramUrl } from '../src/services/incomingShare/instagramUrl';

test('accepts Instagram post and reel URLs', () => {
  assert.equal(
    extractInstagramUrl('https://www.instagram.com/p/AbC_123-/'),
    'https://www.instagram.com/p/AbC_123-/'
  );
  assert.equal(
    extractInstagramUrl('https://instagram.com/reel/Reel_123?igsh=example'),
    'https://instagram.com/reel/Reel_123?igsh=example'
  );
  assert.equal(
    extractInstagramUrl('https://www.instagram.com/reels/Reel_123/'),
    'https://www.instagram.com/reels/Reel_123/'
  );
});

test('extracts an Instagram URL from surrounding shared text', () => {
  assert.equal(
    extractInstagramUrl(
      'Watch this reel: https://www.instagram.com/reel/Shared_123/?igsh=abc.'
    ),
    'https://www.instagram.com/reel/Shared_123/?igsh=abc'
  );
});

test('rejects unsafe or unsupported Instagram-like URLs', () => {
  assert.equal(
    extractInstagramUrl('https://instagram.com.example.org/reel/abc/'),
    null
  );
  assert.equal(extractInstagramUrl('http://www.instagram.com/reel/abc/'), null);
  assert.equal(extractInstagramUrl('https://www.instagram.com/example/'), null);
  assert.equal(
    extractInstagramUrl('https://www.instagram.com/reel/abc/extra/'),
    null
  );
});
