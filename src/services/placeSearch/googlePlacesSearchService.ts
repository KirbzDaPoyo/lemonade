import type { PlaceSearchFunctionResponse } from '../../../supabase/functions/_shared/placeSearchContract';
import { createSupabaseClient } from '../../lib/supabaseClient';
import { mockPlaceSearchService } from './mockPlaceSearchService';
import type { PlaceSearchProvider, PlaceSearchQuery } from './types';

const getFriendlyMessage = (message?: string) =>
  message || 'Google Places search is unavailable right now. Try again later.';

export const googlePlacesSearchService: PlaceSearchProvider = {
  async searchPlaces(query: PlaceSearchQuery) {
    const supabase = createSupabaseClient();

    if (!supabase) {
      return mockPlaceSearchService.searchPlaces(query);
    }

    const { data, error } = await supabase.functions.invoke<PlaceSearchFunctionResponse>(
      'place-search',
      {
        body: query
      }
    );

    if (error) {
      throw new Error(getFriendlyMessage(error.message));
    }

    if (data?.error?.code === 'GOOGLE_PLACES_API_KEY_MISSING') {
      return mockPlaceSearchService.searchPlaces(query);
    }

    if (data?.error) {
      throw new Error(getFriendlyMessage(data.error.message));
    }

    return data?.candidates ?? [];
  }
};
