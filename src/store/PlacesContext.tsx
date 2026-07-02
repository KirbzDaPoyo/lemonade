import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import { initialSavedPlaces } from '../data/mockPlaces';
import { PlaceCard } from '../types/place';

type PlaceInput = Omit<PlaceCard, 'id' | 'createdAt' | 'updatedAt'>;

type PlacesContextValue = {
  places: PlaceCard[];
  addPlace: (place: PlaceInput) => PlaceCard;
  updatePlaceStatus: (id: string, status: PlaceCard['status']) => void;
};

const PlacesContext = createContext<PlacesContextValue | undefined>(undefined);

const makeId = () => `place-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function PlacesProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<PlaceCard[]>(initialSavedPlaces);

  const value = useMemo<PlacesContextValue>(
    () => ({
      places,
      addPlace: (place) => {
        const now = new Date().toISOString();
        const savedPlace: PlaceCard = {
          ...place,
          id: makeId(),
          createdAt: now,
          updatedAt: now
        };

        setPlaces((currentPlaces) => [savedPlace, ...currentPlaces]);
        return savedPlace;
      },
      updatePlaceStatus: (id, status) => {
        setPlaces((currentPlaces) =>
          currentPlaces.map((place) =>
            place.id === id
              ? { ...place, status, updatedAt: new Date().toISOString() }
              : place
          )
        );
      }
    }),
    [places]
  );

  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

export function usePlaces() {
  const context = useContext(PlacesContext);

  if (!context) {
    throw new Error('usePlaces must be used within PlacesProvider');
  }

  return context;
}
