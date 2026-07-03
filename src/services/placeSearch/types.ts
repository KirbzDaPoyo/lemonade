import { PlaceCandidate } from '../../types/place';

export type PlaceSearchQuery = {
  query: string;
  sourceInstagramUrl?: string;
  areaOrCity?: string;
  category?: PlaceCandidate['category'];
  cuisineOrSpecialty?: string;
};

export interface PlaceSearchProvider {
  searchPlaces(query: PlaceSearchQuery): Promise<PlaceCandidate[]>;
}

export type PlaceSearchService = PlaceSearchProvider;
