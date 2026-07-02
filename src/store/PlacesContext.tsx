import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

import { initialSavedPlaces } from '../data/mockPlaces';
import { placesStorage } from '../storage/placesStorage';
import { PlaceCard } from '../types/place';

type PlaceInput = Omit<PlaceCard, 'id' | 'createdAt' | 'updatedAt'>;
type PlaceUpdate = Partial<Omit<PlaceCard, 'id' | 'createdAt' | 'updatedAt'>>;

type PlacesContextValue = {
  places: PlaceCard[];
  isLoading: boolean;
  storageError?: string;
  addPlace: (place: PlaceInput) => PlaceCard;
  updatePlace: (id: string, updates: PlaceUpdate) => void;
  updatePlaceStatus: (id: string, status: PlaceCard['status']) => void;
  deletePlace: (id: string) => void;
};

const PlacesContext = createContext<PlacesContextValue | undefined>(undefined);

const makeId = () => `place-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function PlacesProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<PlaceCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | undefined>();

  const persistPlaces = useCallback((nextPlaces: PlaceCard[]) => {
    placesStorage
      .savePlaces(nextPlaces)
      .then(() => setStorageError(undefined))
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Saved places could not be stored.';
        setStorageError(message);
      });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const hydratePlaces = async () => {
      try {
        const storedPlaces = await placesStorage.loadPlaces();
        const startingPlaces = storedPlaces ?? initialSavedPlaces;

        if (!isMounted) {
          return;
        }

        setPlaces(startingPlaces);
        setStorageError(undefined);

        if (!storedPlaces) {
          persistPlaces(startingPlaces);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Saved places could not be loaded.';

        if (isMounted) {
          setPlaces(initialSavedPlaces);
          setStorageError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void hydratePlaces();

    return () => {
      isMounted = false;
    };
  }, [persistPlaces]);

  const value = useMemo<PlacesContextValue>(
    () => ({
      places,
      isLoading,
      storageError,
      addPlace: (place) => {
        const now = new Date().toISOString();
        const savedPlace: PlaceCard = {
          ...place,
          id: makeId(),
          createdAt: now,
          updatedAt: now
        };

        setPlaces((currentPlaces) => {
          const nextPlaces = [savedPlace, ...currentPlaces];
          persistPlaces(nextPlaces);
          return nextPlaces;
        });

        return savedPlace;
      },
      updatePlace: (id, updates) => {
        setPlaces((currentPlaces) => {
          const now = new Date().toISOString();
          const nextPlaces = currentPlaces.map((place) =>
            place.id === id ? { ...place, ...updates, updatedAt: now } : place
          );

          persistPlaces(nextPlaces);
          return nextPlaces;
        });
      },
      updatePlaceStatus: (id, status) => {
        setPlaces((currentPlaces) => {
          const now = new Date().toISOString();
          const nextPlaces = currentPlaces.map((place) =>
            place.id === id
              ? { ...place, status, updatedAt: now }
              : place
          );

          persistPlaces(nextPlaces);
          return nextPlaces;
        });
      },
      deletePlace: (id) => {
        setPlaces((currentPlaces) => {
          const nextPlaces = currentPlaces.filter((place) => place.id !== id);
          persistPlaces(nextPlaces);
          return nextPlaces;
        });
      }
    }),
    [isLoading, persistPlaces, places, storageError]
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
