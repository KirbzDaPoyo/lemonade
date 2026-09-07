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

export type SupabaseAccessTokenProvider = (options?: {
  skipCache?: boolean;
}) => Promise<string | null>;

const JWT_CLOCK_SKEW_RETRY_DELAYS_MS = [1000, 2000] as const;
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const isJwtClockSkewResponse = async (response: Response) => {
  if (response.status !== 401) {
    return false;
  }

  const body = await response
    .clone()
    .text()
    .catch(() => '');

  return /jwt(?:\s+issued\s+at\s+future|\s+not\s+yet\s+valid)/i.test(body);
};

const withAccessToken = (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  accessToken: string | null
): RequestInit | undefined => {
  if (!accessToken) return init;

  const requestHeaders =
    typeof Request !== 'undefined' && input instanceof Request
      ? input.headers
      : undefined;
  const headers = new Headers(init?.headers ?? requestHeaders);
  headers.set('Authorization', 'Bearer ' + accessToken);

  return { ...init, headers };
};

export const createSupabaseFetchWithJwtClockSkewRetry = (
  baseFetch: typeof fetch = fetch,
  delay: (milliseconds: number) => Promise<void> = wait,
  accessTokenProvider?: SupabaseAccessTokenProvider
): typeof fetch =>
  async (input, init) => {
    let response = await baseFetch(input, init);

    for (const retryDelay of JWT_CLOCK_SKEW_RETRY_DELAYS_MS) {
      if (!(await isJwtClockSkewResponse(response))) {
        return response;
      }

      await delay(retryDelay);
      const freshAccessToken = await accessTokenProvider?.({ skipCache: true });
      response = await baseFetch(
        input,
        withAccessToken(input, init, freshAccessToken ?? null)
      );
    }

    return response;
  };

let client: SupabaseClient | undefined;
let currentAccessTokenProvider: SupabaseAccessTokenProvider | undefined;

export const createFreshTokenSupabaseClient = (accessToken: string) => {
  if (!backendConfig.supabaseUrl || !backendConfig.supabasePublishableKey) {
    return undefined;
  }

  return createClient(
    backendConfig.supabaseUrl,
    backendConfig.supabasePublishableKey,
    {
      accessToken: async () => accessToken,
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    }
  );
};

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
        fetch: createSupabaseFetchWithJwtClockSkewRetry(
          fetch,
          wait,
          (options) => currentAccessTokenProvider?.(options) ?? Promise.resolve(null)
        )
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
