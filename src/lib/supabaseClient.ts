import { createClient } from '@supabase/supabase-js';

import { backendConfig } from '../config/backend';
import { PlaceCategory, PlaceStatus } from '../types/place';

export type SavedPlaceRow = {
  id: string;
  name: string;
  address: string;
  area_or_city: string;
  category: PlaceCategory;
  cuisine_or_specialty: string | null;
  tags: string[];
  notes: string | null;
  source_url: string;
  place_id: string | null;
  map_url: string | null;
  status: PlaceStatus;
  created_at: string;
  updated_at: string;
};

export const createSupabaseClient = () => {
  if (!backendConfig.supabaseUrl || !backendConfig.supabasePublishableKey) {
    return undefined;
  }

  return createClient(backendConfig.supabaseUrl, backendConfig.supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
};
