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
};

const PlacesContext = createContext<PlacesContextValue | undefined>(undefined);

const makeId = () => `place-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const getErrorMessage = (fallback: string, error: unknown) =>
  error instanceof Error ? error.message : fallback;
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
  const repositoryConfiguration = useMemo(
    () => createSavedPlacesRepository(userId, accessTokenProvider),
    [accessTokenProvider, userId]
  );
  const { repository, error: configurationError } = repositoryConfiguration;
  const [places, setPlaces] = useState<PlaceCard[]>([]);
  const [availableTags, setAvailableTags] = useState<PlaceTag[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(repository));
  const [storageError, setStorageError] = useState<string | undefined>(configurationError);

  useEffect(() => {
    let isMounted = true;

    const hydratePlaces = async () => {
      if (!repository) {
        return;
      }

      try {
        const [savedPlaces, savedTags] = await Promise.all([
          repository.listPlaces(),
          repository.listTags()
        ]);

        if (!isMounted) {
          return;
        }

        setPlaces(savedPlaces);
        setAvailableTags(sortTags(savedTags));
        setStorageError(undefined);
      } catch (error) {
        if (isMounted) {
          setStorageError(getErrorMessage('Saved places could not be loaded.', error));
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
      availableTags,
      places,
      isLoading,
      isStorageAvailable: Boolean(repository),
      storageError,
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
          setStorageError(getErrorMessage('Saved place could not be created.', error));
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
          setStorageError(getErrorMessage('Saved place could not be updated.', error));
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
          setStorageError(getErrorMessage('Saved place could not be deleted.', error));
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
          setStorageError(getErrorMessage('Tag could not be created.', error));
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
          setStorageError(getErrorMessage('Tag could not be renamed.', error));
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
          setStorageError(getErrorMessage('Tag could not be deleted.', error));
          return false;
        }
      }
    }),
    [availableTags, configurationError, isLoading, places, repository, storageError]
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
