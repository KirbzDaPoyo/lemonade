# Project Lemonade

Project Lemonade is an Expo app for saving cafes, restaurants, and other places discovered through Instagram posts and reels.

Share an Instagram link to the Android app or paste one manually. Lemonade imports public post metadata, proposes matching real-world places, and lets the signed-in user save the correct result to a private Supabase-backed collection.

> Project status: Release 0.3 source-aware saved places candidate. Live migration verification and the core Android source workflow passed; remaining release gates are documented below.

## Current Features

- Email-based accounts and session persistence through Clerk
- Private, per-user saved places enforced with Supabase Row Level Security
- Android share-sheet support for Instagram post and reel links
- Manual link entry without automatically starting a search
- Instagram metadata import through an authenticated Supabase Edge Function and Apify
- Google Places matching through an authenticated Supabase Edge Function
- Candidate confirmation before a place is saved
- Multiple bounded Instagram source references per saved place, with duplicate-safe save outcomes
- Saved-place lifecycle states: Want to Go, Visited, and Skipped
- An independent Favorite preference
- User-created tags with rename, delete, assignment, and filtering
- Editable notes and links to the original Instagram post and Google Maps
- A targeted retry for transient cross-provider JWT clock skew
- Light, dark, and system appearance with persisted preference
- Expo Router navigation with protected routes and native Android Back behavior
- Privacy-scoped PostHog product analytics and scrubbed Sentry error monitoring
- Versioned JSON export through the native share sheet
- Authenticated account and data deletion with explicit partial-failure handling
- A static, undeployed public account-deletion information page
- Reusable EAS development clients for standalone device testing

Lemonade processes only links submitted by the user. It does not read Instagram DMs or Saved posts, call private Instagram APIs, or download and rehost videos.

## Architecture

| Area | Technology | Responsibility |
| --- | --- | --- |
| Mobile app | Expo, React Native, TypeScript | Navigation, sharing, place management, and account UI |
| Authentication | Clerk | Sign-up, sign-in, verification, and session tokens |
| Database | Supabase Postgres | Saved places, bounded source references, and editable tag catalog |
| Authorization | Supabase RLS | Isolates every user's places, sources, and tags by Clerk subject |
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

Apply every migration in `supabase/migrations` in filename order:

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
