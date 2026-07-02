import { PlaceCandidate } from '../../types/place';

export type PlaceSearchQuery = {
  query: string;
  sourceInstagramUrl?: string;
};

export interface PlaceSearchService {
  searchPlaces(query: PlaceSearchQuery): Promise<PlaceCandidate[]>;
}
