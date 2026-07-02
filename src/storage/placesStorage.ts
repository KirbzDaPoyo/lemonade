import AsyncStorage from '@react-native-async-storage/async-storage';

import { PlaceCard } from '../types/place';

const SAVED_PLACES_KEY = 'project-lemonade:saved-places:v1';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isPlaceCard = (value: unknown): value is PlaceCard => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const place = value as Partial<PlaceCard>;

  return (
    typeof place.id === 'string' &&
    typeof place.placeName === 'string' &&
    typeof place.address === 'string' &&
    typeof place.areaCity === 'string' &&
    typeof place.category === 'string' &&
    isStringArray(place.tags) &&
    typeof place.sourceInstagramUrl === 'string' &&
    typeof place.status === 'string' &&
    typeof place.createdAt === 'string' &&
    typeof place.updatedAt === 'string'
  );
};

const parseSavedPlaces = (rawValue: string): PlaceCard[] => {
  const parsedValue: unknown = JSON.parse(rawValue);

  if (!Array.isArray(parsedValue) || !parsedValue.every(isPlaceCard)) {
    throw new Error('Stored saved places are not in the expected format.');
  }

  return parsedValue;
};

export const placesStorage = {
  async loadPlaces(): Promise<PlaceCard[] | undefined> {
    const rawValue = await AsyncStorage.getItem(SAVED_PLACES_KEY);

    if (!rawValue) {
      return undefined;
    }

    return parseSavedPlaces(rawValue);
  },

  async savePlaces(places: PlaceCard[]): Promise<void> {
    await AsyncStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(places));
  },

  async clearPlaces(): Promise<void> {
    await AsyncStorage.removeItem(SAVED_PLACES_KEY);
  }
};
