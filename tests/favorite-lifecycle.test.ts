import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import type { SavedPlaceRow } from '../src/lib/supabaseClient';
import {
  mapPlaceToRow,
  mapPlaceUpdateToRow,
  mapRowToPlace,
  shouldReplaceIncompleteManualPlace
} from '../src/repositories/savedPlaces/SupabaseSavedPlacesRepository';
import { matchesStatusFilter } from '../src/services/placeFilters';
import type { PlaceCard } from '../src/types/place';

const savedPlaceRow = (overrides: Partial<SavedPlaceRow> = {}): SavedPlaceRow => ({
  id: 'place-id',
  name: 'Saved place',
  address: 'Address',
  area_or_city: 'Hong Kong',
  category: 'restaurant',
  cuisine_or_specialty: 'Cantonese',
  tags: ['cantonese'],
  notes: null,
  source_url: 'https://www.instagram.com/p/example/',
  place_id: 'provider-id',
  map_url: 'https://maps.example/place',
  status: 'visited',
  is_favorite: true,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
  ...overrides
});

const placeCard = (overrides: Partial<PlaceCard> = {}): PlaceCard => ({
  id: 'place-id',
  placeName: 'Saved place',
  address: 'Address',
  areaCity: 'Hong Kong',
  category: 'restaurant',
  cuisineOrSpecialty: 'Cantonese',
  tags: ['cantonese'],
  sourceInstagramUrl: 'https://www.instagram.com/p/example/',
  placeId: 'provider-id',
  mapUrl: 'https://maps.example/place',
  status: 'visited',
  isFavorite: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...overrides
});

test('Favorite filtering is independent of lifecycle status', () => {
  assert.equal(
    matchesStatusFilter(placeCard({ status: 'visited', isFavorite: true }), 'favorite'),
    true
  );
  assert.equal(
    matchesStatusFilter(placeCard({ status: 'want_to_go', isFavorite: true }), 'favorite'),
    true
  );
  assert.equal(
    matchesStatusFilter(placeCard({ status: 'visited', isFavorite: false }), 'favorite'),
    false
  );
});

test('lifecycle status filters ignore the Favorite preference flag', () => {
  const place = placeCard({ status: 'visited', isFavorite: true });

  assert.equal(matchesStatusFilter(place, 'visited'), true);
  assert.equal(matchesStatusFilter(place, 'want_to_go'), false);
  assert.equal(matchesStatusFilter(place, 'all'), true);
});

test('Supabase row mapping reads Favorite separately from lifecycle status', () => {
  const place = mapRowToPlace(savedPlaceRow());

  assert.equal(place.status, 'visited');
  assert.equal(place.isFavorite, true);
});

test('Supabase insert and update mapping write Favorite separately', () => {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...newPlace } = placeCard();
  const insert = mapPlaceToRow(newPlace);

  assert.equal(insert.status, 'visited');
  assert.equal(insert.is_favorite, true);
  assert.deepEqual(mapPlaceUpdateToRow({ status: 'skipped', isFavorite: false }), {
    status: 'skipped',
    is_favorite: false
  });
});

test('a real candidate can replace a legacy incomplete manual save', () => {
  const existingPlace = placeCard({
    address: 'Address to confirm',
    placeId: undefined,
    placeName: 'Hung Hom'
  });
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...replacement } =
    placeCard({
      id: 'replacement-id',
      placeId: 'mai-hei-provider-id',
      placeName: 'Mai Hei'
    });

  assert.equal(
    shouldReplaceIncompleteManualPlace(existingPlace, replacement),
    true
  );
  assert.equal(
    shouldReplaceIncompleteManualPlace(
      { ...existingPlace, address: 'Verified address' },
      replacement
    ),
    false
  );
});

test('Favorite migration preserves preference before assigning a lifecycle fallback', () => {
  const migration = readFileSync(
    resolve(
      '.',
      'supabase/migrations/20260802134112_separate_favorite_from_lifecycle.sql'
    ),
    'utf8'
  );
  const favoriteFlagUpdate = migration.indexOf('set is_favorite = true');
  const lifecycleUpdate = migration.indexOf("when status = 'favorite' then 'want_to_go'");

  assert.ok(favoriteFlagUpdate >= 0);
  assert.ok(lifecycleUpdate > favoriteFlagUpdate);
  assert.match(migration, /when status = 'skip' then 'skipped'/);
  assert.match(migration, /check \(status in \('want_to_go', 'visited', 'skipped'\)\)/);
});
