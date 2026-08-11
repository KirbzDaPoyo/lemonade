# Project Lemonade

Project Lemonade is an Expo app for saving cafes, restaurants, and other places discovered through Instagram posts and reels.

Share an Instagram link to the Android app or paste one manually. Lemonade imports public post metadata, proposes matching real-world places, and lets the signed-in user save the correct result to a private Supabase-backed collection.

> Project status: functional pre-release MVP. The main workflows and account isolation are working; visual design and customization are the next development phase.

## Current Features

- Email-based accounts and session persistence through Clerk
- Private, per-user saved places enforced with Supabase Row Level Security
- Android share-sheet support for Instagram post and reel links
- Manual link entry without automatically starting a search
- Instagram metadata import through an authenticated Supabase Edge Function and Apify
- Google Places matching through an authenticated Supabase Edge Function
- Candidate confirmation before a place is saved
- Saved-place lifecycle states: Want to Go, Visited, and Skipped
- An independent Favorite preference
- User-created tags with rename, delete, assignment, and filtering
- Editable notes and links to the original Instagram post and Google Maps
- A targeted retry for transient cross-provider JWT clock skew
- Internal EAS preview builds for standalone device testing

Lemonade processes only links submitted by the user. It does not read Instagram DMs or Saved posts, call private Instagram APIs, or download and rehost videos.

## Architecture

| Area | Technology | Responsibility |
| --- | --- | --- |
| Mobile app | Expo, React Native, TypeScript | Navigation, sharing, place management, and account UI |
| Authentication | Clerk | Sign-up, sign-in, verification, and session tokens |
| Database | Supabase Postgres | Saved places and editable tag catalog |
| Authorization | Supabase RLS | Isolates every user's places and tags by Clerk subject |
| Server functions | Supabase Edge Functions | Authenticated access to Apify and Google Places |
| Instagram metadata | Apify | Retrieves metadata for a submitted public post or reel |
| Place matching | Google Places API | Returns real-world place candidates |
| Builds | Expo Application Services | Development, preview, and production profiles |

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
npm install
```

Create the local environment file:

```powershell
Copy-Item .env.example .env
```

Configure these public values in `.env`:

```text
EXPO_PUBLIC_PLACE_SEARCH_PROVIDER=google
EXPO_PUBLIC_INSTAGRAM_IMPORT_PROVIDER=apify
EXPO_PUBLIC_DEFAULT_SEARCH_REGION=HK
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
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
- Per-user uniqueness constraints
- Authenticated-only grants and Row Level Security policies
- User-scoped tag rename and delete functions

Anonymous access to saved places and tags is intentionally revoked. Existing data from the earlier no-account MVP must be assigned administratively to the correct Clerk user during migration.

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

Start Metro:

```bash
npm run start
```

Expo Go can be useful for basic JavaScript UI work, but the native share-intent integration requires a development or standalone build.

Run a native Android development build:

```bash
npm run android
```

Create an installable internal preview:

```bash
eas build --profile preview --platform android
```

The EAS project ID and Android/iOS application identifiers are configured in `app.json`.

## Validation

```bash
npm test
npm run typecheck
npx expo-doctor
```

The regression suite covers link validation and sharing behavior, candidate selection, lifecycle and favorite independence, user-managed tags, Clerk ownership and RLS migration expectations, authenticated Edge Functions, and JWT clock-skew retry behavior.

## Project Structure

```text
src/
  components/                 Shared UI components
  navigation/                 App navigation and route types
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
tests/                        Regression tests
```

## Known Scope

- Instagram import supports public post and reel URLs submitted by the user.
- Place-search geography currently defaults to Hong Kong and can be configured for Singapore.
- The app is currently optimized and device-tested on Android; iOS share-extension testing remains pending.
- The visual design is still MVP-level and is scheduled for the next phase.

## Next Phase

The next milestone is a cohesive visual design system: typography, color tokens, spacing, reusable controls, light/dark customization, polished loading and error states, and a screen-by-screen redesign of the main save flow.
