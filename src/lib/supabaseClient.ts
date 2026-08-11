import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { backendConfig } from '../config/backend';
import type { PlaceCategory, PlaceStatus } from '../types/place';

export type SavedPlaceRow = {
  id: string;
  name: string;
  address: string;
  area_or_city: string;
  category: PlaceCategory;
  cuisine_or_specialty: string | null;
  tags: string[];
  user_tags?: string[] | null;
  notes: string | null;
  source_url: string;
  place_id: string | null;
  map_url: string | null;
  status: PlaceStatus;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
};

export type PlaceTagRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
};

export type SupabaseAccessTokenProvider = () => Promise<string | null>;

const JWT_CLOCK_SKEW_RETRY_DELAY_MS = 1000;
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const isJwtIssuedInFutureResponse = async (response: Response) => {
  if (response.status !== 401) {
    return false;
  }

  const body = await response
    .clone()
    .text()
    .catch(() => '');

  return /jwt issued at future/i.test(body);
};

export const createSupabaseFetchWithJwtClockSkewRetry = (
  baseFetch: typeof fetch = fetch,
  delay: (milliseconds: number) => Promise<void> = wait
): typeof fetch =>
  async (input, init) => {
    const response = await baseFetch(input, init);

    if (!(await isJwtIssuedInFutureResponse(response))) {
      return response;
    }

    await delay(JWT_CLOCK_SKEW_RETRY_DELAY_MS);
    return baseFetch(input, init);
  };

let client: SupabaseClient | undefined;
let currentAccessTokenProvider: SupabaseAccessTokenProvider | undefined;

export const createSupabaseClient = (
  accessTokenProvider?: SupabaseAccessTokenProvider
) => {
  if (!backendConfig.supabaseUrl || !backendConfig.supabasePublishableKey) {
    return undefined;
  }

  if (accessTokenProvider) {
    currentAccessTokenProvider = accessTokenProvider;
  }

  client ??= createClient(
    backendConfig.supabaseUrl,
    backendConfig.supabasePublishableKey,
    {
      accessToken: async () => currentAccessTokenProvider?.() ?? null,
      global: {
        fetch: createSupabaseFetchWithJwtClockSkewRetry()
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    }
  );

  return client;
};
