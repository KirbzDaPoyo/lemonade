import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  createSavedPlacesRepository,
  PlaceInput,
  PlaceUpdate
} from '../repositories/savedPlaces';
import { PlaceCard } from '../types/place';

type PlacesContextValue = {
  places: PlaceCard[];
  isLoading: boolean;
  storageError?: string;
  addPlace: (place: PlaceInput) => Promise<PlaceCard | undefined>;
  updatePlace: (id: string, updates: PlaceUpdate) => Promise<boolean>;
  updatePlaceStatus: (id: string, status: PlaceCard['status']) => Promise<boolean>;
  deletePlace: (id: string) => Promise<boolean>;
};

const PlacesContext = createContext<PlacesContextValue | undefined>(undefined);

const makeId = () => `place-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const getErrorMessage = (fallback: string, error: unknown) =>
  error instanceof Error ? error.message : fallback;

export function PlacesProvider({ children }: { children: ReactNode }) {
  const repository = useMemo(() => createSavedPlacesRepository(), []);
  const [places, setPlaces] = useState<PlaceCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | undefined>();

  useEffect(() => {
    let isMounted = true;

    const hydratePlaces = async () => {
      try {
        const savedPlaces = await repository.listPlaces();

        if (!isMounted) {
          return;
        }

        setPlaces(savedPlaces);
        setStorageError(undefined);
      } catch (error) {
        if (isMounted) {
          setStorageError(
            getErrorMessage('Saved places could not be loaded.', error)
          );
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
  }, [repository]);

  const value = useMemo<PlacesContextValue>(
    () => ({
      places,
      isLoading,
      storageError,
      addPlace: async (place) => {
        const now = new Date().toISOString();
        const savedPlace: PlaceCard = {
          ...place,
          id: makeId(),
          createdAt: now,
          updatedAt: now
        };

        try {
          const persistedPlace = await repository.createPlace(savedPlace);

          setPlaces((currentPlaces) => [
            persistedPlace,
            ...currentPlaces.filter((currentPlace) => currentPlace.id !== persistedPlace.id)
          ]);
          setStorageError(undefined);

          return persistedPlace;
        } catch (error) {
          setStorageError(
            getErrorMessage('Saved place could not be created.', error)
          );
          return undefined;
        }
      },
      updatePlace: async (id, updates) => {
        try {
          const persistedPlace = await repository.updatePlace(id, updates);

          setPlaces((currentPlaces) =>
            currentPlaces.map((place) =>
              place.id === id ? persistedPlace : place
            )
          );
          setStorageError(undefined);
          return true;
        } catch (error) {
          setStorageError(
            getErrorMessage('Saved place could not be updated.', error)
          );
          return false;
        }
      },
      updatePlaceStatus: async (id, status) => {
        try {
          const persistedPlace = await repository.updatePlace(id, { status });

          setPlaces((currentPlaces) =>
            currentPlaces.map((place) =>
              place.id === id ? persistedPlace : place
            )
          );
          setStorageError(undefined);
          return true;
        } catch (error) {
          setStorageError(
            getErrorMessage('Saved place status could not be updated.', error)
          );
          return false;
        }
      },
      deletePlace: async (id) => {
        try {
          await repository.deletePlace(id);
          setPlaces((currentPlaces) =>
            currentPlaces.filter((place) => place.id !== id)
          );
          setStorageError(undefined);
          return true;
        } catch (error) {
          setStorageError(
            getErrorMessage('Saved place could not be deleted.', error)
          );
          return false;
        }
      }
    }),
    [isLoading, places, repository, storageError]
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
