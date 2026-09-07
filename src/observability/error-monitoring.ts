import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';

export type ErrorOperation =
  | 'account_deletion'
  | 'app_frame'
  | 'authenticated_navigation'
  | 'authentication_transition'
  | 'data_export'
  | 'import_flow'
  | 'monitoring_verification'
  | 'place_search'
  | 'saved_places_hydration'
  | 'saved_places_write';

export type ErrorCategory =
  | 'account'
  | 'boundary'
  | 'authentication'
  | 'export'
  | 'import'
  | 'navigation'
  | 'search'
  | 'storage'
  | 'verification';

type UnknownRecord = Record<string, unknown>;

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
const environment =
  process.env.EXPO_PUBLIC_APP_ENV?.trim() || (__DEV__ ? 'development' : 'production');
const releaseChannel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL?.trim() || environment;
const version =
  Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? 'unknown';
const build = Application.nativeBuildVersion ?? 'unknown';
const release = `project-lemonade@${version}+${build}`;

const sensitiveKey =
  /(?:authorization|auth|token|cookie|email|caption|note|source|url|uri|query|request|response|body|place|address|search|identifier)/i;
const emailValue = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g;
const urlValue = /https?:\/\/\S+/gi;
const bearerValue = /bearer\s+[a-z0-9._~+/=-]+/gi;

const sanitizeValue = (value: unknown, key = ''): unknown => {
  if (sensitiveKey.test(key)) return '[Filtered]';

  if (typeof value === 'string') {
    return value
      .replace(emailValue, '[Filtered email]')
      .replace(urlValue, '[Filtered URL]')
      .replace(bearerValue, '[Filtered token]');
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as UnknownRecord).map(([childKey, childValue]) => [
        childKey,
        sanitizeValue(childValue, childKey)
      ])
    );
  }

  return value;
};

export const scrubSentryEvent = (event: UnknownRecord): UnknownRecord => {
  const scrubbed = sanitizeValue(event) as UnknownRecord;
  delete scrubbed.request;
  delete scrubbed.extra;
  delete scrubbed.breadcrumbs;

  if (scrubbed.user && typeof scrubbed.user === 'object') {
    const userId = (scrubbed.user as UnknownRecord).id;
    scrubbed.user = typeof userId === 'string' ? { id: userId } : undefined;
  }

  if (scrubbed.exception && typeof scrubbed.exception === 'object') {
    const values = (scrubbed.exception as UnknownRecord).values;
    if (Array.isArray(values)) {
      (scrubbed.exception as UnknownRecord).values = values.map((item) => {
        if (!item || typeof item !== 'object') return item;
        return { ...(item as UnknownRecord), value: 'Unexpected technical failure' };
      });
    }
  }

  if (typeof scrubbed.message === 'string') {
    scrubbed.message = 'Unexpected technical failure';
  }

  return scrubbed;
};

let initialized = false;

export const initializeErrorMonitoring = () => {
  if (initialized || !dsn) return;

  try {
    Sentry.init({
      dsn,
      enabled: true,
      environment,
      release,
      dist: build,
      sendDefaultPii: false,
      enableLogs: false,
      tracesSampleRate: 0,
      profilesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      beforeBreadcrumb: () => null,
      beforeSend: (event) =>
        scrubSentryEvent(event as unknown as UnknownRecord) as unknown as typeof event,
      initialScope: {
        tags: {
          app_build: build,
          app_version: version,
          platform: Platform.OS,
          release_channel: releaseChannel
        }
      }
    });
    initialized = true;
  } catch {
    // Monitoring must never block app startup.
  }
};

export const errorMonitoring = {
  isConfigured: Boolean(dsn),

  captureException(
    error: unknown,
    context: { operation: ErrorOperation; category: ErrorCategory }
  ) {
    if (!dsn) return;

    try {
      Sentry.withScope((scope) => {
        scope.setTag('operation', context.operation);
        scope.setTag('category', context.category);
        Sentry.captureException(error);
      });
    } catch {
      // Monitoring failure must never interrupt product behavior.
    }
  },

  identify(userId: string) {
    if (!dsn || !userId) return;
    try {
      Sentry.setUser({ id: userId });
    } catch {
      // Identity correlation is best effort.
    }
  },

  resetIdentity() {
    if (!dsn) return;
    try {
      Sentry.setUser(null);
    } catch {
      // Identity cleanup is best effort.
    }
  },

  async sendVerificationEvent() {
    if (!dsn || environment === 'production') return false;

    try {
      Sentry.withScope((scope) => {
        scope.setTag('operation', 'monitoring_verification');
        scope.setTag('category', 'verification');
        Sentry.captureException(new Error('Controlled non-production monitoring verification'));
      });
      return await Sentry.flush();
    } catch {
      return false;
    }
  }
};

initializeErrorMonitoring();

export const wrapWithErrorMonitoring = <ComponentType,>(component: ComponentType) =>
  dsn ? Sentry.wrap(component as never) : component;
