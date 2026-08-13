import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  createSavedPlacesRepository,
  PlaceInput,
  PlaceUpdate
} from '../repositories/savedPlaces';
import { getUserTagKey } from '../services/tags/user-tags';
import type { PlaceCard, PlaceTag } from '../types/place';

type PlacesContextValue = {
  availableTags: PlaceTag[];
  places: PlaceCard[];
  isLoading: boolean;
  isStorageAvailable: boolean;
  storageError?: string;
  addPlace: (place: PlaceInput) => Promise<PlaceCard | undefined>;
  updatePlace: (id: string, updates: PlaceUpdate) => Promise<boolean>;
  deletePlace: (id: string) => Promise<boolean>;
  createTag: (name: string) => Promise<PlaceTag | undefined>;
  renameTag: (id: string, name: string) => Promise<boolean>;
  deleteTag: (id: string) => Promise<boolean>;
  retryStorage: () => void;
};

const PlacesContext = createContext<PlacesContextValue | undefined>(undefined);

const makeId = () => `place-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const getStorageErrorMessage = (fallback: string, error: unknown) => {
  if (
    error instanceof Error &&
    /jwt(?:\s+issued\s+at\s+future|\s+not\s+yet\s+valid)/i.test(error.message)
  ) {
    return 'Your private library is still connecting. Please retry in a moment.';
  }

  return fallback;
};
const sortTags = (tags: PlaceTag[]) =>
  [...tags].sort((left, right) => left.name.localeCompare(right.name));

export function PlacesProvider({
  accessTokenProvider,
  children,
  userId
}: {
  accessTokenProvider: () => Promise<string | null>;
  children: ReactNode;
  userId: string;
}) {
  const accessTokenProviderRef = useRef(accessTokenProvider);
  accessTokenProviderRef.current = accessTokenProvider;
  const repositoryConfiguration = useMemo(
    () => createSavedPlacesRepository(userId, () => accessTokenProviderRef.current()),
    [userId]
  );
  const { repository, error: configurationError } = repositoryConfiguration;
  const [places, setPlaces] = useState<PlaceCard[]>([]);
  const [availableTags, setAvailableTags] = useState<PlaceTag[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(repository));
  const [storageError, setStorageError] = useState<string | undefined>(configurationError);
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const hydratePlaces = async () => {
      if (!repository) {
        return;
      }

      if (!hasHydratedRef.current) {
        setIsLoading(true);
      }
      const [placesResult, tagsResult] = await Promise.allSettled([
        repository.listPlaces(),
        repository.listTags()
      ]);

      if (!isMounted) {
        return;
      }

      if (placesResult.status === 'fulfilled') {
        setPlaces(placesResult.value);
      }

      if (tagsResult.status === 'fulfilled') {
        setAvailableTags(sortTags(tagsResult.value));
      }

      if (placesResult.status === 'fulfilled' && tagsResult.status === 'fulfilled') {
        setStorageError(undefined);
      } else {
        const rejectedResult = placesResult.status === 'rejected' ? placesResult : tagsResult;
        setStorageError(
          getStorageErrorMessage(
            'Some library data could not be loaded. Retry to reconnect.',
            rejectedResult.status === 'rejected' ? rejectedResult.reason : undefined
          )
        );
      }

      hasHydratedRef.current = true;
      setIsLoading(false);
    };

    void hydratePlaces();

    return () => {
      isMounted = false;
    };
  }, [hydrationAttempt, repository]);

  const retryStorage = useCallback(() => {
    if (repository) {
      setStorageError(undefined);
      setHydrationAttempt((attempt) => attempt + 1);
    }
  }, [repository]);

  const value = useMemo<PlacesContextValue>(
    () => ({
      availableTags,
      places,
      isLoading,
      isStorageAvailable: Boolean(repository),
      storageError,
      retryStorage,
      addPlace: async (place) => {
        if (!repository) {
          setStorageError(configurationError);
          return undefined;
        }

        const savedPlace = {
          ...place,
          id: makeId()
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
          setStorageError(getStorageErrorMessage('Saved place could not be created. Retry in a moment.', error));
          return undefined;
        }
      },
      updatePlace: async (id, updates) => {
        if (!repository) {
          setStorageError(configurationError);
          return false;
        }

        try {
          const persistedPlace = await repository.updatePlace(id, updates);

          setPlaces((currentPlaces) =>
            currentPlaces.map((place) => (place.id === id ? persistedPlace : place))
          );
          setStorageError(undefined);
          return true;
        } catch (error) {
          setStorageError(getStorageErrorMessage('Saved place could not be updated. Retry in a moment.', error));
          return false;
        }
      },
      deletePlace: async (id) => {
        if (!repository) {
          setStorageError(configurationError);
          return false;
        }

        try {
          await repository.deletePlace(id);
          setPlaces((currentPlaces) => currentPlaces.filter((place) => place.id !== id));
          setStorageError(undefined);
          return true;
        } catch (error) {
          setStorageError(getStorageErrorMessage('Saved place could not be deleted. Retry in a moment.', error));
          return false;
        }
      },
      createTag: async (name) => {
        if (!repository) {
          setStorageError(configurationError);
          return undefined;
        }

        try {
          const createdTag = await repository.createTag(name);
          setAvailableTags((currentTags) => sortTags([...currentTags, createdTag]));
          setStorageError(undefined);
          return createdTag;
        } catch (error) {
          setStorageError(getStorageErrorMessage('Tag could not be created. Retry in a moment.', error));
          return undefined;
        }
      },
      renameTag: async (id, name) => {
        if (!repository) {
          setStorageError(configurationError);
          return false;
        }

        const existingTag = availableTags.find((tag) => tag.id === id);

        if (!existingTag) {
          setStorageError('Tag could not be found.');
          return false;
        }

        try {
          await repository.renameTag(id, name);
          setAvailableTags((currentTags) =>
            sortTags(
              currentTags.map((tag) =>
                tag.id === id ? { ...tag, name, updatedAt: new Date().toISOString() } : tag
              )
            )
          );
          setPlaces((currentPlaces) =>
            currentPlaces.map((place) => ({
              ...place,
              tags: place.tags.map((tag) =>
                getUserTagKey(tag) === getUserTagKey(existingTag.name) ? name : tag
              )
            }))
          );
          setStorageError(undefined);
          return true;
        } catch (error) {
          setStorageError(getStorageErrorMessage('Tag could not be renamed. Retry in a moment.', error));
          return false;
        }
      },
      deleteTag: async (id) => {
        if (!repository) {
          setStorageError(configurationError);
          return false;
        }

        const existingTag = availableTags.find((tag) => tag.id === id);

        if (!existingTag) {
          setStorageError('Tag could not be found.');
          return false;
        }

        try {
          await repository.deleteTag(id);
          setAvailableTags((currentTags) => currentTags.filter((tag) => tag.id !== id));
          setPlaces((currentPlaces) =>
            currentPlaces.map((place) => ({
              ...place,
              tags: place.tags.filter(
                (tag) => getUserTagKey(tag) !== getUserTagKey(existingTag.name)
              )
            }))
          );
          setStorageError(undefined);
          return true;
        } catch (error) {
          setStorageError(getStorageErrorMessage('Tag could not be deleted. Retry in a moment.', error));
          return false;
        }
      }
    }),
    [availableTags, configurationError, isLoading, places, repository, retryStorage, storageError]
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
