import type { PlaceCategory } from './placeSearchContract.ts';

const categoryByType: Record<string, PlaceCategory> = {
  bakery: 'dessert',
  bagel_shop: 'dessert',
  bar: 'bar',
  cafe: 'cafe',
  cake_shop: 'dessert',
  candy_store: 'dessert',
  cat_cafe: 'cafe',
  cocktail_bar: 'bar',
  coffee_roastery: 'cafe',
  coffee_shop: 'cafe',
  coffee_stand: 'cafe',
  confectionery: 'dessert',
  dessert_shop: 'dessert',
  dog_cafe: 'cafe',
  donut_shop: 'dessert',
  food_court: 'market',
  ice_cream_shop: 'dessert',
  lounge_bar: 'bar',
  market: 'market',
  night_market: 'market',
  pastry_shop: 'dessert',
  pub: 'bar',
  restaurant: 'restaurant',
  sports_bar: 'bar',
  wine_bar: 'bar'
};

const categoryForType = (placeType: string): PlaceCategory | undefined => {
  const normalizedType = placeType.trim().toLowerCase();

  if (!normalizedType) {
    return undefined;
  }

  return (
    categoryByType[normalizedType] ??
    (normalizedType.endsWith('_restaurant') ? 'restaurant' : undefined)
  );
};

export const getRecognizedGooglePlaceCategory = (
  primaryType?: string,
  types: string[] = []
): PlaceCategory | undefined => {
  const orderedTypes = [primaryType, ...types].filter(
    (placeType): placeType is string => Boolean(placeType)
  );

  for (const placeType of orderedTypes) {
    const category = categoryForType(placeType);

    if (category) {
      return category;
    }
  }

  return undefined;
};
