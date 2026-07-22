import { createSupabaseClient } from '../../lib/supabaseClient';
import { SupabaseSavedPlacesRepository } from './SupabaseSavedPlacesRepository';
import { SavedPlacesRepository } from './types';

export type { PlaceInput, PlaceUpdate, SavedPlacesRepository } from './types';

export type SavedPlacesRepositoryConfiguration = {
  repository?: SavedPlacesRepository;
  error?: string;
};

export const createSavedPlacesRepository = (): SavedPlacesRepositoryConfiguration => {
  const supabase = createSupabaseClient();

  if (!supabase) {
    return {
      error:
        'Cloud storage is not configured. Add the Supabase URL and publishable key, then restart the app.'
    };
  }

  return { repository: new SupabaseSavedPlacesRepository(supabase) };
};
