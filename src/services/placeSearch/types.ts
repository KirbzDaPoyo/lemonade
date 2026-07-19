import { GeoContext } from '../../types/geo';
import { PlaceSearchCandidate } from '../../types/extraction';
import { PlaceCandidate } from '../../types/place';

export type PlaceSearchQuery = {
  query: string;
  searchCandidates?: PlaceSearchCandidate[];
  sourceInstagramUrl?: string;
  areaOrCity?: string;
  category?: PlaceCandidate['category'];
  cuisineOrSpecialty?: string;
  geoContext?: GeoContext;
};

export interface PlaceSearchProvider {
  searchPlaces(query: PlaceSearchQuery): Promise<PlaceCandidate[]>;
}

export type PlaceSearchService = PlaceSearchProvider;
