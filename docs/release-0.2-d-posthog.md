# Release 0.2-D: PostHog product analytics

Work Package 0.2-D adds privacy-safe product analytics through a central typed
adapter. Product behavior remains unchanged when PostHog is unavailable or not
configured.

## Configuration

- `EXPO_PUBLIC_POSTHOG_API_KEY` supplies the PostHog project key.
- `EXPO_PUBLIC_POSTHOG_HOST` supplies the ingestion host.
- `EXPO_PUBLIC_APP_ENV` labels events as `development`, `preview`, or
  `production`.
- Autocapture and session replay are disabled.

The preview EAS environment is configured separately from local development and
production. No private application data or provider credentials are sent to
PostHog.

## Privacy contract

The adapter accepts only the event names and bounded properties declared in
`src/observability/analytics-contract.ts`. It never captures email addresses,
place names, addresses, source URLs, notes, captions, search text, provider
payloads, authentication tokens, or raw error messages.

Authenticated sessions are correlated using the Clerk user ID only. Analytics
identity is reset during sign-out. Capture and flush failures are best effort and
never block an application action.

## Instrumented journey

The approved Release 0.2 journey covers authentication, incoming shares, manual
add, import outcomes, candidate display and selection, place saving and opening,
map launch, status and favorite changes, and sign-out. Expected import failures
are normalized into a small failure-category enum.

## Validation

- Automated analytics-contract and navigation regression tests pass.
- TypeScript validation passes.
- Expo configuration validation passes.
- Preview Android device testing confirmed event delivery, identity behavior,
  appearance persistence, and successful Instagram and map launches.

Unexpected technical failures remain outside PostHog's responsibility and are
assigned to Work Package 0.2-E through Sentry.
