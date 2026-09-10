import type { PlaceStatus } from '../types/place';
import type { PlaceSaveOutcome } from '../repositories/savedPlaces/types';
import type { PlaceSourceMediaType } from '../types/place-source';

export type AnalyticsEnvironment = 'development' | 'preview' | 'production';
export type AnalyticsFailureCategory =
  | 'private_post'
  | 'unsupported_url'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'no_match'
  | 'network'
  | 'unexpected';

export const normalizeAnalyticsEnvironment = (
  value: string | undefined,
  isDevelopment: boolean
): AnalyticsEnvironment => {
  if (value === 'development' || value === 'preview' || value === 'production') {
    return value;
  }

  return isDevelopment ? 'development' : 'preview';
};

export const normalizeAnalyticsFailureCategory = (
  error: unknown
): AnalyticsFailureCategory => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (/private|login required|not public/.test(message)) return 'private_post';
  if (/unsupported|invalid.*url|instagram url|post or reel/.test(message)) {
    return 'unsupported_url';
  }
  if (/rate.?limit|too many requests|\b429\b/.test(message)) return 'rate_limited';
  if (/network|fetch|timed? out|timeout|offline|connection/.test(message)) {
    return 'network';
  }
  if (/no useful|no match|not found|couldn.t identify|could not identify/.test(message)) {
    return 'no_match';
  }
  if (/unavailable|configuration|not configured|provider|apify/.test(message)) {
    return 'provider_unavailable';
  }

  return 'unexpected';
};

export const boundAnalyticsResultCount = (count: number) =>
  Math.max(0, Math.min(20, Math.trunc(Number.isFinite(count) ? count : 0)));

export const boundAnalyticsCandidateRank = (rank: number) =>
  Math.max(1, Math.min(20, Math.trunc(Number.isFinite(rank) ? rank : 1)));

export type AnalyticsEventProperties = {
  library_search_started: Record<string, never>;
  library_filters_cleared: Record<string, never>;
  library_filter_changed: { filter_type: 'status' | 'favorite' | 'tag' | 'category' | 'area' };
  library_sort_changed: { sort: 'newest' | 'oldest' | 'updated' | 'name' };
  library_density_changed: { density: 'comfortable' | 'compact' };
  auth_completed: { method: 'email_code' };
  share_received: { provider: 'instagram'; platform: string };
  manual_add_opened: Record<string, never>;
  import_started: { provider: 'apify' };
  import_succeeded: { provider: 'apify' };
  import_failed: {
    provider: 'apify';
    failure_category: AnalyticsFailureCategory;
  };
  candidates_displayed: {
    provider: 'google_places';
    result_count: number;
  };
  candidate_selected: {
    provider: 'google_places';
    candidate_rank: number;
  };
  place_saved: { status: PlaceStatus };
  place_save_completed: {
    outcome: PlaceSaveOutcome;
    source_platform: 'instagram';
  };
  place_opened: { status: PlaceStatus };
  map_link_opened: { provider: 'google_maps' };
  instagram_source_opened: {
    source_platform: 'instagram';
    media_type: PlaceSourceMediaType;
  };
  place_status_changed: {
    previous_status: PlaceStatus;
    status: PlaceStatus;
  };
  favorite_changed: { is_favorite: boolean };
  signed_out: Record<string, never>;
};

export type AnalyticsEventName = keyof AnalyticsEventProperties;
