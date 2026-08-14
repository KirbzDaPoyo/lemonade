declare const process: {
  env: {
    EXPO_PUBLIC_PLACE_SEARCH_PROVIDER?: 'mock' | 'google' | string;
    EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
    EXPO_PUBLIC_POSTHOG_API_KEY?: string;
    EXPO_PUBLIC_POSTHOG_HOST?: string;
    EXPO_PUBLIC_APP_ENV?: 'development' | 'preview' | 'production';
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_INSTAGRAM_IMPORT_PROVIDER?: 'apify' | 'mock' | string;
    EXPO_PUBLIC_DEFAULT_SEARCH_REGION?: 'HK' | 'SG' | string;
    [key: string]: string | undefined;
  };
};
