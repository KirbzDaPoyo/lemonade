import { PlaceCategory, PlaceStatus } from '../types/place';

export const categoryLabels: Record<PlaceCategory, string> = {
  cafe: 'Cafe',
  restaurant: 'Restaurant',
  street_food: 'Street food',
  dessert: 'Dessert',
  bar: 'Bar',
  market: 'Market',
  other: 'Other'
};

export const statusLabels: Record<PlaceStatus, string> = {
  want_to_go: 'Want to go',
  visited: 'Visited',
  favorite: 'Favorite',
  skip: 'Skip'
};
