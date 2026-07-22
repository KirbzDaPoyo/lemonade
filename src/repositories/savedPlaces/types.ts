import { PlaceCard } from '../../types/place';

export type PlaceInput = Omit<PlaceCard, 'id' | 'createdAt' | 'updatedAt'>;
export type NewPlace = PlaceInput & Pick<PlaceCard, 'id'>;
type MutablePlace = Omit<PlaceCard, 'id' | 'createdAt' | 'updatedAt'>;
type ClearablePlaceField = 'cuisineOrSpecialty' | 'notes' | 'mapUrl' | 'placeId';

export type PlaceUpdate = Partial<
  Omit<MutablePlace, ClearablePlaceField> & {
    cuisineOrSpecialty: string | null;
    notes: string | null;
    mapUrl: string | null;
    placeId: string | null;
  }
>;

export interface SavedPlacesRepository {
  listPlaces(): Promise<PlaceCard[]>;
  createPlace(place: NewPlace): Promise<PlaceCard>;
  updatePlace(id: string, updates: PlaceUpdate): Promise<PlaceCard>;
  deletePlace(id: string): Promise<void>;
}
