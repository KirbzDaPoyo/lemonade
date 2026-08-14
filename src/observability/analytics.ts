import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { PostHog } from 'posthog-react-native';

import {
  AnalyticsEventName,
  AnalyticsEventProperties,
  boundAnalyticsCandidateRank,
  boundAnalyticsResultCount,
  normalizeAnalyticsEnvironment,
  normalizeAnalyticsFailureCategory
} from './analytics-contract';

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY?.trim();
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim();
const environment = normalizeAnalyticsEnvironment(
  process.env.EXPO_PUBLIC_APP_ENV,
  __DEV__
);

const commonProperties = {
  environment,
  platform: Platform.OS,
  app_version:
    Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? 'unknown',
  app_build: Application.nativeBuildVersion ?? 'unknown'
};

const createClient = () => {
  if (!apiKey || !host) return null;

  try {
    return new PostHog(apiKey, {
      host,
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
      errorTracking: { autocapture: false },
      preloadFeatureFlags: false,
      sendFeatureFlagEvent: false,
      setDefaultPersonProperties: false
    });
  } catch {
    return null;
  }
};

const client = createClient();
let identifiedUserId: string | null = null;
let pendingAuthCompleted = false;

const capture = <EventName extends AnalyticsEventName>(
  event: EventName,
  properties: AnalyticsEventProperties[EventName]
) => {
  try {
    client?.capture(event, { ...commonProperties, ...properties });
  } catch {
    // Analytics must never interrupt product behavior.
  }
};

const flushWithDeadline = async (deadlineMs = 600) => {
  if (!client) return;

  try {
    await Promise.race([
      client.flush(),
      new Promise<void>((resolve) => setTimeout(resolve, deadlineMs))
    ]);
  } catch {
    // A failed analytics flush must not block sign-out.
  }
};

export const analytics = {
  isConfigured: Boolean(client),

  identify(userId: string) {
    if (!client || !userId || identifiedUserId === userId) return;

    try {
      client.identify(userId);
      identifiedUserId = userId;
      if (pendingAuthCompleted) {
        capture('auth_completed', { method: 'email_code' });
        pendingAuthCompleted = false;
      }
    } catch {
      // Identification is best effort and must not affect authentication.
    }
  },

  markAuthenticationCompleted() {
    pendingAuthCompleted = true;
    if (identifiedUserId) {
      capture('auth_completed', { method: 'email_code' });
      pendingAuthCompleted = false;
    }
  },

  reset() {
    pendingAuthCompleted = false;
    identifiedUserId = null;
    try {
      client?.reset();
    } catch {
      // Identity cleanup remains best effort when analytics is unavailable.
    }
  },

  async signOut() {
    capture('signed_out', {});
    await flushWithDeadline();
    this.reset();
  },

  shareReceived() {
    capture('share_received', { provider: 'instagram', platform: Platform.OS });
  },
  manualAddOpened() {
    capture('manual_add_opened', {});
  },
  importStarted() {
    capture('import_started', { provider: 'apify' });
  },
  importSucceeded() {
    capture('import_succeeded', { provider: 'apify' });
  },
  importFailed(error: unknown) {
    capture('import_failed', {
      provider: 'apify',
      failure_category: normalizeAnalyticsFailureCategory(error)
    });
  },
  candidatesDisplayed(resultCount: number) {
    capture('candidates_displayed', {
      provider: 'google_places',
      result_count: boundAnalyticsResultCount(resultCount)
    });
  },
  candidateSelected(candidateRank: number) {
    capture('candidate_selected', {
      provider: 'google_places',
      candidate_rank: boundAnalyticsCandidateRank(candidateRank)
    });
  },
  placeSaved(status: AnalyticsEventProperties['place_saved']['status']) {
    capture('place_saved', { status });
  },
  placeOpened(status: AnalyticsEventProperties['place_opened']['status']) {
    capture('place_opened', { status });
  },
  mapLinkOpened() {
    capture('map_link_opened', { provider: 'google_maps' });
  },
  placeStatusChanged(
    previousStatus: AnalyticsEventProperties['place_status_changed']['previous_status'],
    status: AnalyticsEventProperties['place_status_changed']['status']
  ) {
    capture('place_status_changed', {
      previous_status: previousStatus,
      status
    });
  },
  favoriteChanged(isFavorite: boolean) {
    capture('favorite_changed', { is_favorite: isFavorite });
  }
};
