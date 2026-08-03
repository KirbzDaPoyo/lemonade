import { placeSearchConfig } from '../../config/placeSearch';
import { googlePlacesSearchService } from './googlePlacesSearchService';
import { mockPlaceSearchService } from './mockPlaceSearchService';

export const placeSearchService =
  placeSearchConfig.provider === 'google'
    ? googlePlacesSearchService
    : mockPlaceSearchService;
