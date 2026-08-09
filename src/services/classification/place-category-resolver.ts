import type { PlaceExtractionResult } from '../../types/extraction';
import type { PlaceCandidate, PlaceCategory } from '../../types/place';

const MINIMUM_INFERRED_CATEGORY_CONFIDENCE = 0.65;

const manualCategorySignals: Array<{
  category: Exclude<PlaceCategory, 'other'>;
  pattern: RegExp;
}> = [
  { category: 'cafe', pattern: /\b(cafe|coffee|espresso|latte)\b/i },
  { category: 'restaurant', pattern: /\b(restaurant|bistro|diner)\b/i },
  { category: 'street_food', pattern: /\b(street[\s_-]+food|stall|hawker)\b/i },
  { category: 'dessert', pattern: /\b(dessert|cake|bakery|ice[\s_-]+cream)\b/i },
  { category: 'bar', pattern: /\b(bar|cocktail|wine|beer)\b/i },
  { category: 'market', pattern: /\b(market|food[\s_-]+hall)\b/i }
];

export const inferPlaceCategoryFromText = (value: string): PlaceCategory | undefined =>
  manualCategorySignals.find(({ pattern }) => pattern.test(value))?.category;

const getConfidentInferredCategory = (extraction?: PlaceExtractionResult) => {
  if (!extraction || extraction.confidence < MINIMUM_INFERRED_CATEGORY_CONFIDENCE) {
    return undefined;
  }

  return extraction.category ?? inferPlaceCategoryFromText(extraction.placeName ?? '');
};

export const resolveCandidatePlaceCategory = (
  candidate: PlaceCandidate,
  extraction?: PlaceExtractionResult
): PlaceCategory => {
  const providerCategoryIsRecognized =
    candidate.providerCategoryRecognized ?? candidate.category !== 'other';

  if (providerCategoryIsRecognized) {
    return candidate.category;
  }

  return getConfidentInferredCategory(extraction) ?? 'other';
};
