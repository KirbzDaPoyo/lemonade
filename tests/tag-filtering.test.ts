import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  getAssignedTagFilterOptions,
  matchesPlacesScreenFilters,
  matchesTagFilter
} from '../src/services/placeFilters';
import type { PlaceCard, PlaceTag } from '../src/types/place';

const placeCard = (overrides: Partial<PlaceCard> = {}): PlaceCard => ({
  id: 'place-id',
  placeName: 'Saved place',
  address: 'Address',
  areaCity: 'Hong Kong',
  category: 'other',
  cuisineOrSpecialty: undefined,
  tags: [],
  sourceInstagramUrl: 'https://www.instagram.com/p/example/',
  sources: [],
  status: 'visited',
  isFavorite: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...overrides
});

const placeTag = (id: string, name: string): PlaceTag => ({
  id,
  name,
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z'
});

test('a user tag is the sole source of tag filter membership', () => {
  const taggedOther = placeCard({ category: 'other', tags: ['Coffee'] });
  const untaggedCafe = placeCard({ category: 'cafe', tags: [] });

  assert.equal(matchesTagFilter(taggedOther, 'Coffee'), true);
  assert.equal(matchesTagFilter(untaggedCafe, 'Coffee'), false);
});

test('tag matching is case-insensitive and trims surrounding whitespace', () => {
  assert.equal(matchesTagFilter(placeCard({ tags: ['Date Night'] }), ' date night '), true);
});

test('status and tag filtering use AND logic', () => {
  const place = placeCard({ status: 'visited', tags: ['Bakery'] });

  assert.equal(matchesPlacesScreenFilters(place, 'visited', 'Bakery'), true);
  assert.equal(matchesPlacesScreenFilters(place, 'want_to_go', 'Bakery'), false);
  assert.equal(matchesPlacesScreenFilters(place, 'visited', 'Coffee'), false);
});

test('All tags preserves status-only filtering', () => {
  const place = placeCard({ status: 'visited', tags: [] });

  assert.equal(matchesPlacesScreenFilters(place, 'visited', null), true);
  assert.equal(matchesPlacesScreenFilters(place, 'want_to_go', null), false);
});

test('only catalog tags assigned to at least one place are offered as filters', () => {
  const tags = [
    placeTag('coffee-id', 'Coffee'),
    placeTag('unused-id', 'Unused'),
    placeTag('bakery-id', 'Bakery')
  ];
  const places = [placeCard({ tags: ['coffee'] }), placeCard({ id: 'two', tags: ['Bakery'] })];

  assert.deepEqual(
    getAssignedTagFilterOptions(places, tags).map((tag) => tag.id),
    ['coffee-id', 'bakery-id']
  );
});

test('Places UI uses tag chips and no fixed Place dropdown', () => {
  const home = readFileSync(resolve('.', 'src/screens/v2-home-screen.tsx'), 'utf8');
  const filterBar = readFileSync(resolve('.', 'src/components/v2-filter-rack.tsx'), 'utf8');

  assert.match(home, /V2FilterRack/);
  assert.doesNotMatch(home, /selectedPlaceFilter|PlaceFilterSelection/);
  assert.doesNotMatch(filterBar, /label="Place"|selectedPlaceFilter/);
});

test('Place Detail exposes tags without primary-category or fixed-filter editors', () => {
  const detail = readFileSync(resolve('.', 'src/screens/v2-place-detail-screen.tsx'), 'utf8');

  assert.match(detail, /UserTagsEditor/);
  assert.doesNotMatch(detail, /PlaceClassificationEditor|handleCategoryChange|handleFilterMembershipChange/);
  assert.doesNotMatch(detail, /categoryLabels|getEffectivePlaceCategory/);
});
