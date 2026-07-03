import { backendConfig } from '../../config/backend';
import { initialSavedPlaces } from '../../data/mockPlaces';
import { createSupabaseClient } from '../../lib/supabaseClient';
import { LocalSavedPlacesRepository } from './LocalSavedPlacesRepository';
import { SupabaseSavedPlacesRepository } from './SupabaseSavedPlacesRepository';
import { SavedPlacesRepository } from './types';

export type { PlaceInput, PlaceUpdate, SavedPlacesRepository } from './types';

export const createSavedPlacesRepository = (): SavedPlacesRepository => {
  if (backendConfig.savedPlacesBackend === 'supabase') {
    const supabase = createSupabaseClient();

    if (supabase) {
      return new SupabaseSavedPlacesRepository(supabase);
    }
  }

  return new LocalSavedPlacesRepository(initialSavedPlaces);
};
