# Project Lemonade

Project Lemonade is an Expo app for saving cafes, restaurants, and other places discovered through Instagram posts and reels.

Share Instagram links to a private import inbox, or paste up to 20 at a time. Capture never calls Instagram or Google. Choose Process, then Find Place to import public metadata, confirm a real-world match, and save it to your private library. Direct Add Place remains available.

> Project status: Release 0.6.0 preview installed and owner-tested. Automated checks pass and hosted migrations are applied. The owner walkthrough reports 19 passes and one explicitly skipped Maps fallback device check; general UI improvements are deferred beyond 0.6. See [Release 0.6 implementation and verification](docs/release-0.6-outing-plans.md) for evidence and limitations.

## Current Features

- Private outing plans with up to 20 saved places, comparison, completion/reopening, and local Pick for me
- Google Maps and directions handoff using saved Place IDs or validated fallbacks, without location permission or provider lookups

- Email-based accounts and session persistence through Clerk
- Private, per-user saved places enforced with Supabase Row Level Security
- Durable private import inbox with 100 pending links per user, canonical deduplication, manual retries, and share capture that preserves active imports
- Android share-sheet support for Instagram post and reel links
- Manual link entry without automatically starting a search
- Instagram metadata import through an authenticated Supabase Edge Function and Apify
- Google Places matching through an authenticated Supabase Edge Function
- Candidate confirmation before a place is saved
- Multiple bounded Instagram source references per saved place, with duplicate-safe save outcomes
- Saved-place lifecycle states: Want to Go, Visited, and Skipped
- Local token search across saved places and bounded source metadata
- Combined status, favorite, tag, category and area filters
- Four stable sort orders and comfortable/compact rows, with per-account local presentation preferences
- An independent Favorite preference
- User-created tags with rename, delete, assignment, and filtering
- Editable notes and links to the original Instagram post and Google Maps
- A targeted retry for transient cross-provider JWT clock skew
- Light, dark, and system appearance with persisted preference
- Expo Router navigation with protected routes and native Android Back behavior
- Privacy-scoped PostHog product analytics and scrubbed Sentry error monitoring
- Schema-4 JSON export including outing plans and ordered memberships through the native share sheet
- Authenticated account and data deletion with explicit partial-failure handling
- A static, undeployed public account-deletion information page
- Reusable EAS development clients for standalone device testing

Lemonade processes only links submitted by the user. It does not read Instagram DMs or Saved posts, call private Instagram APIs, or download and rehost videos.

## Architecture

| Area | Technology | Responsibility |
| --- | --- | --- |
| Mobile app | Expo, React Native, TypeScript | Navigation, sharing, place management, and account UI |
| Authentication | Clerk | Sign-up, sign-in, verification, and session tokens |
| Database | Supabase Postgres | Saved places, bounded source references, import inbox, outing plans, and editable tag catalog |
| Authorization | Supabase RLS | Isolates every user's places, sources, inbox, plans, and tags by Clerk subject |
| Server functions | Supabase Edge Functions | Authenticated access to Apify and Google Places |
| Instagram metadata | Apify | Retrieves metadata for a submitted public post or reel |
| Place matching | Google Places API | Returns real-world place candidates |
| Product analytics | PostHog | Allowlisted, privacy-safe funnel events |
| Error monitoring | Sentry | Scrubbed unexpected technical failures |
| Public information | Static HTML/CSS in `web/` | Undeployed account-deletion instructions |
| Builds | Expo Application Services | Development, preview, and production profiles |
| CI | GitHub Actions | Locked installation, regression tests, and type-checking |

Provider secrets stay in Supabase. The mobile bundle contains only public Expo configuration values.

## Prerequisites

- Node.js and npm
- An Expo account and EAS CLI
- A Supabase project
- A Clerk application connected through Supabase Third-Party Auth
- Apify and Google Places API credentials for the real provider flow

## Local Setup

Install dependencies:

```bash
npm ci
```

Create the local environment file:

```powershell
Copy-Item .env.example .env.local
```

Configure these public values in `.env.local`:

```text
EXPO_PUBLIC_PLACE_SEARCH_PROVIDER=google
EXPO_PUBLIC_INSTAGRAM_IMPORT_PROVIDER=apify
EXPO_PUBLIC_DEFAULT_SEARCH_REGION=HK
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
EXPO_PUBLIC_POSTHOG_API_KEY=your-posthog-project-key
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
EXPO_PUBLIC_SENTRY_DSN=your-public-sentry-dsn
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_RELEASE_CHANNEL=development
```

Use `EXPO_PUBLIC_PLACE_SEARCH_PROVIDER=mock` when Google Places is not configured.

Never put a Supabase secret/service-role key, Clerk secret key, Apify token, or Google Places secret in an `EXPO_PUBLIC_` variable. Expo public values are embedded in the app.

## Clerk and Supabase

This project uses Clerk as a Supabase Third-Party Auth provider. Configure the integration in both services before running the authenticated data flow:

1. Connect the Clerk application from Clerk's Supabase integration setup.
2. Enable Clerk under **Supabase → Authentication → Third-Party Auth**.
3. Ensure Clerk session tokens contain `"role": "authenticated"`.
4. Use the Clerk publishable key in the Expo environment.

The app passes the current Clerk session token to `supabase-js`. Database policies compare its `sub` claim with each row's `user_id`.

## Supabase Database

After separate deployment authorization, apply every migration in `supabase/migrations` in filename order. Apply the additive 0.5 inbox migration before distributing a 0.5 client; the 0.4 client remains compatible:

```bash
supabase db push
```

The current schema includes:

- `saved_places`, scoped by `user_id`
- `place_tags`, scoped by `user_id`
- `saved_place_sources`, scoped by `user_id` and linked to an owned place
- Per-user uniqueness constraints
- Authenticated-only grants and Row Level Security policies
- User-scoped tag rename and delete functions

Anonymous access to saved places, source references, and tags is intentionally revoked. Existing data from the earlier no-account MVP must be assigned administratively to the correct Clerk user during migration.

## Edge Functions

Set provider credentials as Supabase secrets:

```bash
supabase secrets set APIFY_API_TOKEN=your-apify-token
supabase secrets set GOOGLE_PLACES_API_KEY=your-google-places-key
```

Deploy both functions:

```bash
supabase functions deploy instagram-import
supabase functions deploy place-search
```

The function settings in `supabase/config.toml` disable Supabase gateway JWT verification because the gateway does not validate Clerk tokens for this configuration. Both handlers instead verify the Clerk signature, issuer, subject, and authenticated role before contacting Apify or Google. Do not remove that handler-level verification.

The mobile client never receives either provider secret.

## Running the App

For routine TypeScript, JavaScript, and styling work, start Metro for the installed development client:

```bash
npx expo start --dev-client
```

Expo Go is suitable only for flows that do not require Lemonade's native share integration. Create another development build only after native dependency, config-plugin, permission, identifier, or native-project changes:

```bash
eas build --profile development --platform android
```

Create an installable preview only for a deliberate acceptance checkpoint:

```bash
eas build --profile preview --platform android
```

CI never invokes EAS builds or deployments.

## Validation

```bash
npm test
npm run typecheck
npx expo-doctor
```

The regression suite covers sharing, navigation contracts, source normalization and metadata bounds, atomic save contracts, source-aware detail states, lifecycle and favorites, user-managed tags, Clerk ownership, RLS, authenticated Edge Functions, privacy-safe observability, export, account deletion, and the public deletion page.

See the [Release 0.3 source-aware saved places record](docs/release-0.3-source-aware-saved-places.md). Release 0.2 history remains in [operations and privacy](docs/release-0.2-operations.md) and the [verification record](docs/release-0.2-verification.md).

## Project Structure

```text
src/
  components/                 Shared UI components
  design-system/              Theme tokens, appearance persistence, and motion preferences
  navigation/                 Route contracts and incoming-share coordination
  observability/              PostHog and Sentry privacy adapters
  repositories/savedPlaces/  Supabase saved-place and tag data access
  screens/                    Authentication, account, import, places, and detail screens
  services/placeExtraction/  Instagram metadata interpretation
  services/placeSearch/      Mock and Google-backed place matching
  store/                      Authenticated place and tag state
  types/                      Domain and environment types
  utils/                      Display and link helpers
supabase/
  functions/                  Authenticated Instagram import and place search
  migrations/                 Database schema, tag catalog, and user ownership
tests/                        Regression and contract tests
web/                          Static public deletion information; not deployed
```

## Known Scope

- Instagram import supports public post and reel URLs submitted by the user.
- Place-search geography currently defaults to Hong Kong and can be configured for Singapore.
- Android device acceptance is complete for the Release 0.3 one-source, duplicate-source, multi-source, persistence, export, and deletion flows against the migrated database.
- Physical iOS, large-text/screen-reader, production signing, store submission, and public-page deployment remain pending.
- Candidate ranking is advisory; users deliberately choose a result before saving.

## Release 0.7 — Map and nearby library

Version 0.7.0 adds an explicit Map entry, existing library filters, a bounded Google map of up to 20 saved places, optional foreground-only nearby distances, and existing detail/directions/outing-plan actions. Opening the map never automatically resolves positions or requests device location.

Coordinates live only in account-session memory. `place-locations` verifies Clerk identity and owned saved IDs before reserving daily quota (60/user, 250/project) and requesting exactly Google `id,location`. No coordinate columns or export schema change were added. User-scoped operational counters are deleted with account data; aggregate global counters remain.

Setup: install the lockfile, use separate restricted `GOOGLE_MAPS_ANDROID_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY` at build time, and configure the server-only Places key for the Edge Function. `EXPO_PUBLIC_MAP_RESOLVER=mock` supplies labeled synthetic positions for cost-free development; `real` requires the deployed resolver. Keys/APIs, hosted migration/deployment, live checks and publication require explicit authorization. Missing native keys yield a controlled fallback. Location is requested only from Near me, accepts approximate permission, and adds no background service or tracking.

Pinned new runtime dependencies: react-native-maps 1.20.1, expo-location 19.0.8, react-native-web 0.21.2. A **new native binary** is required; appVersion runtime 0.7.0 cannot update the 0.6.0 binary. Native projects remain generated/untracked.

See [Release 0.7 implementation and verification](docs/release-0.7-map-nearby.md) for exact architecture, migration, cost assumptions, official policy sources, commands/results, pending device acceptance, rollout and rollback. Privacy/terms drafts are local under `web/`; they are not published. No guaranteed-free or device-acceptance claim is made.
