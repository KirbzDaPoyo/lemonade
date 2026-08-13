import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { extractInstagramUrl } from '../src/services/incomingShare/instagramUrl';
import { getIncomingInstagramUrl } from '../src/navigation/share-routing';

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

test('incoming shares prefill the URL without starting a search automatically', () => {
  const coordinatorSource = readFileSync('src/navigation/share-coordinator.tsx', 'utf8');
  const addPlaceSource = readFileSync('src/screens/AddPlaceScreen.tsx', 'utf8');

  assert.equal(
    getIncomingInstagramUrl(
      null,
      'Watch https://www.instagram.com/reel/Shared_456/ now'
    ),
    'https://www.instagram.com/reel/Shared_456/'
  );
  assert.match(coordinatorSource, /beginSharedAdd\(instagramUrl\)/);
  assert.match(coordinatorSource, /resetShareIntent\(\)/);
  assert.doesNotMatch(coordinatorSource, /autoStart/);
  assert.doesNotMatch(addPlaceSource, /handleFindPlace\(initialInstagramUrl\)/);
});

test('candidate selection does not offer incomplete manual saves', () => {
  const candidateSource = readFileSync(
    'src/screens/CandidateMatchScreen.tsx',
    'utf8'
  );

  assert.doesNotMatch(candidateSource, /Save Manually/);
  assert.doesNotMatch(candidateSource, /handleSaveManually/);
  assert.doesNotMatch(candidateSource, /Draft from Instagram/);
  assert.match(candidateSource, /handleSaveCandidate/);
});
