import assert from 'node:assert/strict';
import test from 'node:test';

import { getRecognizedGooglePlaceCategory } from '../supabase/functions/_shared/google-place-category';
import { resolveCandidatePlaceCategory } from '../src/services/classification/place-category-resolver';
import type { PlaceExtractionResult } from '../src/types/extraction';
import type { PlaceCandidate } from '../src/types/place';

const extraction = (
  category: PlaceExtractionResult['category'],
  confidence: number,
  placeName = 'Imported place'
): PlaceExtractionResult => ({
  placeName,
  areaOrCity: 'Hong Kong',
  category,
  cuisineOrSpecialty: null,
  recommendedItems: [],
  vibeTags: [],
  searchQuery: placeName,
  searchCandidates: [],
  geoContext: {
    regionCode: 'HK',
    searchSuffix: 'Hong Kong',
    locationBias: {
      low: { latitude: 22.13, longitude: 113.82 },
      high: { latitude: 22.57, longitude: 114.43 }
    }
  },
  confidence,
});

const candidate = (overrides: Partial<PlaceCandidate> = {}): PlaceCandidate => ({
  provider: 'google_places',
  providerPlaceId: 'provider-id',
  name: 'Candidate',
  address: 'Address',
  areaCity: 'Hong Kong',
  category: 'other',
  tags: [],
  ...overrides
});

test('specialty Google restaurant primary types map to Restaurant', () => {
  assert.equal(getRecognizedGooglePlaceCategory('ramen_restaurant'), 'restaurant');
  assert.equal(getRecognizedGooglePlaceCategory('cantonese_restaurant'), 'restaurant');
});

test('recognized primary category takes precedence over secondary types', () => {
  assert.equal(
    getRecognizedGooglePlaceCategory('coffee_shop', ['cafe', 'restaurant']),
    'cafe'
  );
});

test('recognized secondary type is used when the primary type is unknown', () => {
  assert.equal(
    getRecognizedGooglePlaceCategory('new_google_food_type', ['restaurant', 'food']),
    'restaurant'
  );
});

test('unknown Google types remain unresolved instead of being labeled Other prematurely', () => {
  assert.equal(getRecognizedGooglePlaceCategory('new_google_food_type', ['food']), undefined);
});

test('recognized provider category wins over inferred category', () => {
  assert.equal(
    resolveCandidatePlaceCategory(
      candidate({ category: 'cafe', providerCategoryRecognized: true }),
      extraction('restaurant', 0.9)
    ),
    'cafe'
  );
});

test('unresolved provider category falls back to a confident inferred category', () => {
  assert.equal(
    resolveCandidatePlaceCategory(
      candidate({ providerCategoryRecognized: false }),
      extraction('restaurant', 0.8)
    ),
    'restaurant'
  );
});

test('unresolved provider category ignores low-confidence inference', () => {
  assert.equal(
    resolveCandidatePlaceCategory(
      candidate({ providerCategoryRecognized: false }),
      extraction('restaurant', 0.4)
    ),
    'other'
  );
});
