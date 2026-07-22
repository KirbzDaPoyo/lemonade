import type { PlaceSearchRequest } from '../../../supabase/functions/_shared/placeSearchContract';
import type { PlaceCandidate } from '../../types/place';

export type PlaceSearchQuery = PlaceSearchRequest;

export interface PlaceSearchProvider {
  searchPlaces(query: PlaceSearchQuery): Promise<PlaceCandidate[]>;
}
