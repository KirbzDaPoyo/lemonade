import type { PlaceExtractionResult } from './extraction';

export type PlaceCategory =
  | 'cafe'
  | 'restaurant'
  | 'street_food'
  | 'dessert'
  | 'bar'
  | 'market'
  | 'other';

export type PlaceStatus = 'want_to_go' | 'visited' | 'favorite' | 'skip';

export type PlaceCandidateProvider = 'mock' | 'google_places';

export type PlaceCandidate = {
  provider: PlaceCandidateProvider;
  providerPlaceId: string;
  name: string;
  address: string;
  areaCity: string;
  category: PlaceCategory;
  cuisineOrSpecialty?: string;
  tags: string[];
  mapUrl?: string;
  latitude?: number;
  longitude?: number;
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
};

export type PlaceCard = {
  id: string;
  placeName: string;
  address: string;
  areaCity: string;
  category: PlaceCategory;
  cuisineOrSpecialty?: string;
  tags: string[];
  notes?: string;
  sourceInstagramUrl: string;
  mapUrl?: string;
  placeId?: string;
  status: PlaceStatus;
  createdAt: string;
  updatedAt: string;
};

export type DraftPlaceEntry = {
  sourceInstagramUrl: string;
  suggestedPlaceName: string;
  extraction?: PlaceExtractionResult;
  notes?: string;
  captionText?: string;
  screenshotUri?: string;
};
