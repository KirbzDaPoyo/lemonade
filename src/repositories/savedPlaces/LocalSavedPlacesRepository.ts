import { placesStorage } from '../../storage/placesStorage';
import { PlaceCard } from '../../types/place';
import {
  findDuplicateSavedPlace,
  normalizeInstagramSourceUrl
} from './placeIdentity';
import { PlaceUpdate, SavedPlacesRepository } from './types';

const normalizePlaceUpdate = (updates: PlaceUpdate): Partial<PlaceCard> => {
  const {
    cuisineOrSpecialty,
    notes,
    mapUrl,
    placeId,
    ...otherUpdates
  } = updates;

  return {
    ...otherUpdates,
    ...(cuisineOrSpecialty !== undefined
      ? { cuisineOrSpecialty: cuisineOrSpecialty ?? undefined }
      : {}),
    ...(notes !== undefined ? { notes: notes ?? undefined } : {}),
    ...(mapUrl !== undefined ? { mapUrl: mapUrl ?? undefined } : {}),
    ...(placeId !== undefined ? { placeId: placeId ?? undefined } : {})
  };
};

export class LocalSavedPlacesRepository implements SavedPlacesRepository {
  readonly kind = 'local';
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly seedPlaces: PlaceCard[] = []) {}
  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }


  private async loadPlaces() {
    const storedPlaces = await placesStorage.loadPlaces();

    if (storedPlaces) {
      return storedPlaces;
    }

    if (this.seedPlaces.length > 0) {
      await placesStorage.savePlaces(this.seedPlaces);
    }

    return this.seedPlaces;
  }
  async listPlaces() {
    return this.runExclusive(() => this.loadPlaces());
  }

  async createPlace(place: PlaceCard) {
    return this.runExclusive(async () => {
      const places = await this.loadPlaces();
      const normalizedPlace = {
        ...place,
        sourceInstagramUrl: normalizeInstagramSourceUrl(place.sourceInstagramUrl)
      };
      const existingPlace = findDuplicateSavedPlace(places, normalizedPlace);

      if (existingPlace) {
        return existingPlace;
      }

      await placesStorage.savePlaces([normalizedPlace, ...places]);
      return normalizedPlace;
    });
  }

  async updatePlace(id: string, updates: PlaceUpdate) {
    return this.runExclusive(async () => {
      const places = await this.loadPlaces();
      const now = new Date().toISOString();
      let updatedPlace: PlaceCard | undefined;

      const nextPlaces = places.map((place) => {
        if (place.id !== id) {
          return place;
        }

        updatedPlace = {
          ...place,
          ...normalizePlaceUpdate(updates),
          ...(updates.sourceInstagramUrl !== undefined
            ? {
                sourceInstagramUrl: normalizeInstagramSourceUrl(
                  updates.sourceInstagramUrl
                )
              }
            : {}),
          updatedAt: now
        };
        return updatedPlace;
      });

      if (!updatedPlace) {
        throw new Error('Saved place was not found locally.');
      }

      const otherPlaces = places.filter((place) => place.id !== id);
      const duplicatePlace = findDuplicateSavedPlace(otherPlaces, updatedPlace);

      if (duplicatePlace) {
        throw new Error('This place is already saved.');
      }

      await placesStorage.savePlaces(nextPlaces);
      return updatedPlace;
    });
  }

  async deletePlace(id: string) {
    return this.runExclusive(async () => {
      const places = await this.loadPlaces();
      await placesStorage.savePlaces(places.filter((place) => place.id !== id));
    });
  }
}
