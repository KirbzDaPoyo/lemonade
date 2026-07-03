import { placeSearchConfig } from '../../config/placeSearch';
import { googlePlacesSearchService } from './googlePlacesSearchService';
import { mockPlaceSearchService } from './mockPlaceSearchService';

export const placeSearchService =
  placeSearchConfig.provider === 'google'
    ? googlePlacesSearchService
    : mockPlaceSearchService;

export { mockPlaceSearchService } from './mockPlaceSearchService';
export { googlePlacesSearchService } from './googlePlacesSearchService';
export type { PlaceSearchProvider, PlaceSearchQuery, PlaceSearchService } from './types';
