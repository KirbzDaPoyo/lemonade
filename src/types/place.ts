import type {
  PlaceCandidate as SharedPlaceCandidate,
  PlaceCategory as SharedPlaceCategory
} from '../../supabase/functions/_shared/placeSearchContract';
import type { PlaceExtractionResult } from './extraction';
import type { PlaceSource, PlaceSourceDraft } from './place-source';

export type PlaceCategory = SharedPlaceCategory;
export type PlaceStatus = 'want_to_go' | 'visited' | 'skipped';
export type PlaceCandidate = SharedPlaceCandidate;

export type PlaceTag = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
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
  sources: PlaceSource[];
  mapUrl?: string;
  placeId?: string;
  status: PlaceStatus;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DraftPlaceEntry = {
  inboxItemId?: string;
  sourceInstagramUrl: string;
  source?: PlaceSourceDraft;
  extraction?: PlaceExtractionResult;
};

export type { PlaceSource, PlaceSourceDraft, PlaceSourceMediaType } from './place-source';
