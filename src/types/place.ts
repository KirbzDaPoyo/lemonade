import type {
  PlaceCandidate as SharedPlaceCandidate,
  PlaceCandidateProvider as SharedPlaceCandidateProvider,
  PlaceCategory as SharedPlaceCategory
} from '../../supabase/functions/_shared/placeSearchContract';
import type { PlaceExtractionResult } from './extraction';

export type PlaceCategory = SharedPlaceCategory;

export type PlaceStatus = 'want_to_go' | 'visited' | 'favorite' | 'skip';

export type PlaceCandidateProvider = SharedPlaceCandidateProvider;

export type PlaceCandidate = SharedPlaceCandidate;

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
  sharedText?: string;
  userHint?: string;
  screenshotUri?: string;
};
