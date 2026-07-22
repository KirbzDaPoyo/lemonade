const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const backendConfig = {
  supabaseUrl,
  supabasePublishableKey,
  hasSupabaseConfig: Boolean(supabaseUrl && supabasePublishableKey)
};
