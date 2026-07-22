import type {
  PlaceSearchCandidate as SharedPlaceSearchCandidate,
  PlaceSearchSourceSignal as SharedPlaceSearchSourceSignal
} from '../../supabase/functions/_shared/placeSearchContract';
import type { GeoContext } from './geo';
import type { PlaceCategory } from './place';

export type PlaceSearchSourceSignal = SharedPlaceSearchSourceSignal;
export type PlaceSearchCandidate = SharedPlaceSearchCandidate;

export type PlaceExtractionResult = {
  placeName: string | null;
  areaOrCity: string | null;
  category: PlaceCategory | null;
  cuisineOrSpecialty: string | null;
  recommendedItems: string[];
  vibeTags: string[];
  visibleClues: string[];
  searchQuery: string;
  searchCandidates: PlaceSearchCandidate[];
  geoContext: GeoContext;
  confidence: number;
  needsUserConfirmation: boolean;
  missingFields: string[];
};