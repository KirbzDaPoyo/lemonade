import {
  createSupabaseClient,
  type SupabaseAccessTokenProvider
} from '../../lib/supabaseClient';
import { SupabaseSavedPlacesRepository } from './SupabaseSavedPlacesRepository';
import { SavedPlacesRepository } from './types';

export type { NewPlace, PlaceInput, PlaceUpdate, SavedPlacesRepository } from './types';

export type SavedPlacesRepositoryConfiguration = {
  repository?: SavedPlacesRepository;
  error?: string;
};

export const createSavedPlacesRepository = (
  userId: string,
  accessTokenProvider: SupabaseAccessTokenProvider
): SavedPlacesRepositoryConfiguration => {
  const supabase = createSupabaseClient(accessTokenProvider);

  if (!supabase) {
    return {
      error:
        'Cloud storage is not configured. Add the Supabase URL and publishable key, then restart the app.'
    };
  }

  return {
    repository: new SupabaseSavedPlacesRepository(supabase, userId)
  };
};
