import { placesStorage } from '../../storage/placesStorage';
import { PlaceCard } from '../../types/place';
import { PlaceUpdate, SavedPlacesRepository } from './types';

export class LocalSavedPlacesRepository implements SavedPlacesRepository {
  readonly kind = 'local';

  constructor(private readonly seedPlaces: PlaceCard[] = []) {}

  async listPlaces() {
    const storedPlaces = await placesStorage.loadPlaces();

    if (storedPlaces) {
      return storedPlaces;
    }

    if (this.seedPlaces.length > 0) {
      await placesStorage.savePlaces(this.seedPlaces);
    }

    return this.seedPlaces;
  }

  async createPlace(place: PlaceCard) {
    const places = await this.listPlaces();
    await placesStorage.savePlaces([place, ...places]);
    return place;
  }

  async updatePlace(id: string, updates: PlaceUpdate) {
    const places = await this.listPlaces();
    const now = new Date().toISOString();
    let updatedPlace: PlaceCard | undefined;

    const nextPlaces = places.map((place) => {
      if (place.id !== id) {
        return place;
      }

      updatedPlace = { ...place, ...updates, updatedAt: now };
      return updatedPlace;
    });

    if (!updatedPlace) {
      throw new Error('Saved place was not found locally.');
    }

    await placesStorage.savePlaces(nextPlaces);
    return updatedPlace;
  }

  async deletePlace(id: string) {
    const places = await this.listPlaces();
    await placesStorage.savePlaces(places.filter((place) => place.id !== id));
  }
}
