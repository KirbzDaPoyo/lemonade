import type { GeoContext } from './geo';
import type { PlaceCategory } from './place';

export type PlaceSearchSourceSignal =
  | 'pin_line'
  | 'raw_handle'
  | 'tagged_user'
  | 'collaborator'
  | 'title_line'
  | 'address_line'
  | 'instagram_location'
  | 'user_hint';

export type PlaceSearchCandidate = {
  query: string;
  reason: string;
  confidence: number;
  parsedPlaceName?: string;
  parsedAddress?: string;
  sourceSignal: PlaceSearchSourceSignal;
};

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