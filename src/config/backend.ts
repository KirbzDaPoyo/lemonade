export type SavedPlacesBackend = 'local' | 'supabase';

const requestedBackend = process.env.EXPO_PUBLIC_SAVED_PLACES_BACKEND;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const backendConfig = {
  requestedBackend,
  supabaseUrl,
  supabasePublishableKey,
  hasSupabaseConfig: Boolean(supabaseUrl && supabasePublishableKey),
  savedPlacesBackend: resolveSavedPlacesBackend()
};

function resolveSavedPlacesBackend(): SavedPlacesBackend {
  if (requestedBackend === 'local') {
    return 'local';
  }

  if (requestedBackend === 'supabase') {
    return supabaseUrl && supabasePublishableKey ? 'supabase' : 'local';
  }

  return supabaseUrl && supabasePublishableKey ? 'supabase' : 'local';
}
