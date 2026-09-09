import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPlaceDataExport,
  serializePlaceDataExport
} from '../src/services/export/place-data-export';
import type { PlaceCard, PlaceTag } from '../src/types/place';

const place: PlaceCard = {
  id: 'place-1',
  placeName: 'Cafe Example',
  address: '1 Test Street',
  areaCity: 'Kowloon',
  category: 'cafe',
  cuisineOrSpecialty: 'coffee shop',
  tags: ['coffee', 'café'],
  notes: 'Try the crème brûlée.',
  sourceInstagramUrl: 'https://www.instagram.com/reel/example/',
  sources: [{
    id: 'source-1',
    savedPlaceId: 'place-1',
    platform: 'instagram',
    sourceUrl: 'https://www.instagram.com/reel/example/',
    shortcode: 'example',
    mediaType: 'reel',
    creatorUsername: 'creator',
    captionExcerpt: 'Try the custard latte.',
    recommendedItems: ['custard latte'],
    vibeTags: ['bright'],
    thumbnailUrl: 'https://images.example/source.jpg',
    publishedAt: '2026-08-31T01:02:03.000Z',
    createdAt: '2026-09-01T01:02:03.000Z'
  }],
  mapUrl: 'https://maps.google.com/?q=example',
  placeId: 'provider-place-1',
  status: 'want_to_go',
  isFavorite: true,
  createdAt: '2026-09-01T01:02:03.000Z',
  updatedAt: '2026-09-02T01:02:03.000Z'
};

const tag: PlaceTag = {
  id: 'tag-1',
  name: 'café',
  createdAt: '2026-09-01T01:02:03.000Z',
  updatedAt: '2026-09-01T01:02:03.000Z'
};

test('data export is versioned and contains every portable place field', () => {
  const dataExport = createPlaceDataExport(
    [place],
    [tag],
    '2026-09-07T09:00:00.000Z'
  );

  assert.equal(dataExport.format, 'project-lemonade-data-export');
  assert.equal(dataExport.schemaVersion, 2);
  assert.equal(dataExport.exportedAt, '2026-09-07T09:00:00.000Z');
  assert.deepEqual(dataExport.data.savedPlaces[0], {
    id: 'place-1',
    name: 'Cafe Example',
    address: '1 Test Street',
    areaOrCity: 'Kowloon',
    category: 'cafe',
    specialty: 'coffee shop',
    tags: ['coffee', 'café'],
    notes: 'Try the crème brûlée.',
    status: 'want_to_go',
    favorite: true,
    createdAt: '2026-09-01T01:02:03.000Z',
    updatedAt: '2026-09-02T01:02:03.000Z',
    sourceInstagramUrl: 'https://www.instagram.com/reel/example/',
    mapUrl: 'https://maps.google.com/?q=example',
    providerPlaceId: 'provider-place-1',
    sources: [{
      id: 'source-1',
      platform: 'instagram',
      sourceUrl: 'https://www.instagram.com/reel/example/',
      shortcode: 'example',
      mediaType: 'reel',
      creatorUsername: 'creator',
      captionExcerpt: 'Try the custard latte.',
      recommendedItems: ['custard latte'],
      vibeTags: ['bright'],
      thumbnailUrl: 'https://images.example/source.jpg',
      publishedAt: '2026-08-31T01:02:03.000Z',
      createdAt: '2026-09-01T01:02:03.000Z'
    }]
  });
  assert.deepEqual(dataExport.data.tags, [tag]);
  assert.equal('userId' in dataExport, false);
  assert.equal('email' in dataExport, false);
});

test('data export serializes valid UTF-8 JSON with a trailing newline', () => {
  const serialized = serializePlaceDataExport(
    createPlaceDataExport([place], [tag], '2026-09-07T09:00:00.000Z')
  );
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.data.savedPlaces[0].notes, 'Try the crème brûlée.');
  assert.equal(serialized.endsWith('\n'), true);
});

test('optional values are represented as null for a stable schema', () => {
  const dataExport = createPlaceDataExport([
    {
      ...place,
      cuisineOrSpecialty: undefined,
      notes: undefined,
      mapUrl: undefined,
      placeId: undefined
    }
  ], []);

  assert.equal(dataExport.data.savedPlaces[0]?.specialty, null);
  assert.equal(dataExport.data.savedPlaces[0]?.notes, null);
  assert.equal(dataExport.data.savedPlaces[0]?.mapUrl, null);
  assert.equal(dataExport.data.savedPlaces[0]?.providerPlaceId, null);
});
