# Release 0.2 operations and privacy

This document records the configuration and operating boundaries for Project Lemonade Release 0.2. Public Expo values are configuration, not secrets; provider and administrative credentials must remain server-side.

## Environment configuration

| Variable | Purpose | Required where |
| --- | --- | --- |
| `EXPO_PUBLIC_APP_ENV` | Labels development, preview, or production telemetry | All builds |
| `EXPO_PUBLIC_RELEASE_CHANNEL` | Labels the release channel in error reports | All builds |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Initializes Clerk authentication | Authenticated builds |
| `EXPO_PUBLIC_SUPABASE_URL` | Connects to the Supabase project | Supabase builds |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public RLS-protected database key | Supabase builds |
| `EXPO_PUBLIC_INSTAGRAM_IMPORT_PROVIDER` | Selects `apify` or the local mock | All builds |
| `EXPO_PUBLIC_PLACE_SEARCH_PROVIDER` | Selects `google` or the local mock | All builds |
| `EXPO_PUBLIC_DEFAULT_SEARCH_REGION` | Sets the default region hint | All builds |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | Enables privacy-scoped product events | Monitored builds |
| `EXPO_PUBLIC_POSTHOG_HOST` | Selects the PostHog ingestion host | Monitored builds |
| `EXPO_PUBLIC_SENTRY_DSN` | Enables scrubbed unexpected-error reports | Monitored builds |

Never place Clerk secret keys, Supabase service-role keys, Apify tokens, Google Places keys, Sentry auth tokens, or other privileged credentials in `EXPO_PUBLIC_*`. Apify and Google credentials belong in Supabase Edge Function secrets. A Sentry source-map token, if later used, belongs only in EAS or CI secrets.

## PostHog boundary

Release 0.2 uses Product Analytics only. Autocapture and Session Replay stay disabled. Product code sends an allowlisted event taxonomy through `src/observability/analytics.ts`; event properties are bounded enums, booleans, or small counts.

PostHog may receive the Clerk user ID for correlation plus app version, native build, platform, environment, and release channel. It must not receive email addresses, place names, addresses, notes, captions, source URLs, search text, tokens, provider payloads, or raw errors. Identity is reset on sign-out and after successful account deletion.

Expected user-facing outcomes belong in PostHog. Unexpected technical failures belong in Sentry; the same handled event should not be indiscriminately sent to both systems.

## Sentry boundary

Release 0.2 uses Error Tracking only. Performance tracing, profiling, Session Replay, logs, and paid-volume features remain disabled. Monitoring is a no-op when the DSN is absent and must never block a user action.

The central adapter in `src/observability/error-monitoring.ts` limits context to stable operation and failure-category tags. Its `beforeSend` scrubber removes request bodies, authentication material, cookies, email-like values, URLs, captions, notes, search text, provider bodies, addresses, and other user-entered place data. Sentry user correlation contains only the Clerk user ID and is reset on sign-out or completed deletion.

The controlled verification error is available only outside production. Do not expose it in a production build.

## Data export and deletion

Data export queries the authenticated, RLS-scoped repository, creates versioned UTF-8 JSON on-device, and opens the native share sheet. The user chooses the destination. The cache file is replaced on the next export. Export does not call Apify or Google Places.

Account deletion requires an exact typed confirmation and a fresh Clerk token. The authenticated Supabase RPC derives ownership only from the JWT subject, deletes matching saved places and tags transactionally, and cannot accept another user ID. Clerk identity deletion follows database deletion. The UI explicitly distinguishes database failure from the partial state where database deletion succeeded but Clerk deletion did not.

The static public instructions in `web/` have no form, scripts, analytics, cookies, credentials, or backend access. They remain undeployed until the repository owner explicitly approves deployment. An email address alone never authorizes deletion.

## Development-client workflow

Use the installed development client for routine TypeScript, JavaScript, styling, and documentation work:

```bash
npx expo start --dev-client
```

Create another native development build only when native dependencies, Expo config plugins, application identifiers, permissions, or native projects change. EAS builds are never invoked by CI.

## CI boundary

`.github/workflows/ci.yml` runs on pushes and pull requests with read-only repository permission. It installs the committed lockfile with `npm ci`, then runs tests and type-checking. It has no application secrets, deployment credentials, EAS command, provider call, or production mutation.
