import { PlaceCard } from '../../types/place';

export type PlaceInput = Omit<PlaceCard, 'id' | 'createdAt' | 'updatedAt'>;
export type PlaceUpdate = Partial<Omit<PlaceCard, 'id' | 'createdAt' | 'updatedAt'>>;

export type SavedPlacesRepositoryKind = 'local' | 'supabase';

export interface SavedPlacesRepository {
  kind: SavedPlacesRepositoryKind;
  listPlaces(): Promise<PlaceCard[]>;
  createPlace(place: PlaceCard): Promise<PlaceCard>;
  updatePlace(id: string, updates: PlaceUpdate): Promise<PlaceCard>;
  deletePlace(id: string): Promise<void>;
}
