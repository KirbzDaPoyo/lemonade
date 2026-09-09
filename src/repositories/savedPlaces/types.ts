import type { PlaceCard, PlaceTag } from '../../types/place';
import type { PlaceSourceDraft } from '../../types/place-source';

export type PlaceInput = Omit<
  PlaceCard,
  'id' | 'createdAt' | 'updatedAt' | 'sources'
> & {
  source?: PlaceSourceDraft;
};
export type NewPlace = PlaceInput & Pick<PlaceCard, 'id'>;
type MutablePlace = Omit<
  PlaceCard,
  'id' | 'createdAt' | 'updatedAt' | 'sources'
>;
type ClearablePlaceField = 'cuisineOrSpecialty' | 'notes' | 'mapUrl' | 'placeId';

export type PlaceUpdate = Partial<
  Omit<MutablePlace, ClearablePlaceField> & {
    cuisineOrSpecialty: string | null;
    notes: string | null;
    mapUrl: string | null;
    placeId: string | null;
  }
>;
export type SavedPlacesExportData = { places: PlaceCard[]; tags: PlaceTag[] };

export type PlaceSaveOutcome =
  | 'created_place'
  | 'attached_source'
  | 'existing_source';

export type PlaceSaveResult = {
  outcome: PlaceSaveOutcome;
  place: PlaceCard;
};
export interface SavedPlacesRepository {
  listPlaces(): Promise<PlaceCard[]>;
  listSources(savedPlaceId?: string): Promise<PlaceCard['sources']>;
  getExportData(): Promise<SavedPlacesExportData>;
  listTags(): Promise<PlaceTag[]>;
  createTag(name: string): Promise<PlaceTag>;
  renameTag(id: string, name: string): Promise<void>;
  deleteTag(id: string): Promise<void>;
  savePlace(place: NewPlace): Promise<PlaceSaveResult>;
  createPlace(place: NewPlace): Promise<PlaceCard>;
  updatePlace(id: string, updates: PlaceUpdate): Promise<PlaceCard>;
  deletePlace(id: string): Promise<void>;
}
