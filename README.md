# Project Lemonade

An MVP Expo app for saving cafes, restaurants, and vendors discovered from Instagram reels or posts.

The MVP is intentionally based on user-initiated sharing or pasting. It stores the original Instagram URL and lets the user confirm a place from a mock place-search provider. It does not scrape Instagram, import Saved posts, read DMs, or call Instagram APIs.

## What is included

- Saved Places list with status and category filters
- Add Place screen for an Instagram URL, place name, optional caption text, and notes
- Mock extraction service for AI-ready caption/notes parsing without calling a real AI API
- Mock place-search service that returns candidate matches
- Candidate confirmation flow
- Place Detail screen with source URL, map URL, tags, notes, and status updates
- Local persistence for saved places using Expo-compatible AsyncStorage
- Optional Supabase-backed saved places repository with local fallback
- TypeScript domain models and service interfaces designed for a future Google Places or Supabase integration

## Setup

Install dependencies:

```bash
npm install
```

This includes `@react-native-async-storage/async-storage` for local saved-place persistence, `@supabase/supabase-js` for the optional backend repository, and `react-native-url-polyfill` for React Native Supabase compatibility.

Create a local env file when you want to test Supabase:

```bash
copy .env.example .env
```

Local storage is the default when Supabase values are missing:

```text
EXPO_PUBLIC_SAVED_PLACES_BACKEND=local
EXPO_PUBLIC_PLACE_SEARCH_PROVIDER=mock
```

To use Supabase, set:

```text
EXPO_PUBLIC_SAVED_PLACES_BACKEND=supabase
EXPO_PUBLIC_PLACE_SEARCH_PROVIDER=mock
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-key
```

Do not put service role keys or other secrets in Expo public environment variables.

Start the app:

```bash
npm run start
```

Then open it with Expo Go, an iOS simulator, or an Android emulator from the Expo terminal.

## Useful Scripts

```bash
npm run typecheck
npm run android
npm run ios
```

## Project Structure

```text
src/
  components/              Shared UI building blocks
  data/                    Mock candidates and seed saved places
  navigation/              Lightweight MVP navigation types and router
  repositories/savedPlaces/ Local and Supabase saved-place data access
  screens/                 Home, Add Place, Candidate Match, Place Detail
  services/placeExtraction/ AI-ready extraction interface and mock implementation
  services/placeSearch/    Provider interface and mock implementation
  storage/                 Local persistence adapter for saved places
  store/                   In-memory saved places state
  types/                   Domain types for place cards and filters
  utils/                   Display labels and formatting helpers
```

## Supabase Setup

Run the SQL in `supabase/migrations/001_create_saved_places.sql` in your Supabase SQL editor.

The migration creates a `saved_places` table with:

```text
id, name, address, area_or_city, category, cuisine_or_specialty, tags,
notes, source_url, place_id, map_url, status, created_at, updated_at
```

The included row-level security policies allow anonymous CRUD access so the no-auth MVP can work from Expo Go. This is for development only. Before production, add authentication, add a `user_id` column, and replace the permissive policies with user-scoped policies.

If Supabase environment variables are missing, the app automatically uses the local repository. If variables are present and `EXPO_PUBLIC_SAVED_PLACES_BACKEND` is not `local`, saved places are read and written through Supabase.

## Google Places Search

The mobile app never calls Google Places directly. Real place search is routed through the Supabase Edge Function in `supabase/functions/place-search/index.ts`.

Use the mock provider by default:

```text
EXPO_PUBLIC_PLACE_SEARCH_PROVIDER=mock
```

Use Google Places through Supabase:

```text
EXPO_PUBLIC_PLACE_SEARCH_PROVIDER=google
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-key
```

Set the Google key only as a Supabase secret. Do not commit it to `.env`, `.env.example`, or source code:

```bash
supabase secrets set GOOGLE_PLACES_API_KEY=your-google-places-api-key
```

Deploy the Edge Function:

```bash
supabase functions deploy place-search --project-ref your-project-ref
```

For local Edge Function testing:

```bash
supabase functions serve place-search --env-file supabase/.env.local
```

The function uses Google Places Text Search (New), normalizes results to app candidates, and returns fields such as Google place ID, formatted address, area/city, coordinates, Google Maps URL, primary type, rating, and review count. If `GOOGLE_PLACES_API_KEY` is missing, the app falls back to mock search.

## Future Integration Notes

- Keep `src/services/placeSearch/mockPlaceSearchService.ts` for offline development and use `EXPO_PUBLIC_PLACE_SEARCH_PROVIDER=google` when testing real Google Places matching.
- Replace `src/services/placeExtraction/mockPlaceExtractionService.ts` with a real AI provider when extraction is ready.
- Add Supabase auth and user-scoped saved-place policies before multi-user production testing.
- Add auth only after the local save flow and database schema are stable.
