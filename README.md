# Project Lemonade

An MVP Expo app for saving cafes, restaurants, and vendors discovered from Instagram reels or posts.

The MVP is intentionally based on user-initiated sharing or pasting. It stores the original Instagram URL and lets the user confirm a place from a mock place-search provider. It does not scrape Instagram, import Saved posts, read DMs, or call Instagram APIs.

## What is included

- Saved Places list with status and category filters
- Add Place screen for an Instagram URL with a manual search fallback
- Mock extraction service for AI-ready Instagram metadata parsing without calling a real AI API
- Mock place-search service that returns candidate matches
- Optional Instagram metadata import through Apify, called only from a Supabase Edge Function
- Candidate confirmation flow
- Place Detail screen with source URL, map URL, tags, editable notes, and status updates
- Supabase-backed cloud persistence for saved places
- Visible configuration errors when cloud storage is unavailable
- TypeScript domain models and service interfaces designed for a future Google Places or Supabase integration

## Setup

Install dependencies:

```bash
npm install
```

This includes `@react-native-async-storage/async-storage` for Supabase authentication sessions, `@supabase/supabase-js` for cloud persistence, and `react-native-url-polyfill` for React Native Supabase compatibility.

Create a local env file and configure Supabase:

```bash
copy .env.example .env
```

Saved places require these Supabase settings:

```text
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
  data/                    Mock place-search candidates
  navigation/              Lightweight MVP navigation types and router
  repositories/savedPlaces/ Supabase saved-place data access
  screens/                 Home, Add Place, Candidate Match, Place Detail
  services/placeExtraction/ AI-ready extraction interface and mock implementation
  services/placeSearch/    Provider interface and mock implementation
  store/                   In-memory saved places state
  types/                   Domain types for place cards and filters
  utils/                   Display labels and formatting helpers
```

## Curated Tags

Saved place tags are intentionally normalized into a controlled, filterable vocabulary. Instagram hashtags and account-like signals are used as extraction clues, but noisy social tags such as `fyp`, `hkblog`, `hkliving`, generic foodie tags, and travel/blog hashtags are not saved as place tags.

The tag normalizer lives in `src/services/tags/placeTagNormalizer.ts`. It maps useful cuisine, vibe, and context clues into tags such as `coffee`, `bakery`, `ramen`, `late_night`, `self_service`, `date_spot`, and `work_friendly`. Home includes a tag filter row based on the curated tags currently present in saved places.

## Supabase Setup

Run the SQL in `supabase/migrations/001_create_saved_places.sql` in your Supabase SQL editor.

The migration creates a `saved_places` table with:

```text
id, name, address, area_or_city, category, cuisine_or_specialty, tags,
notes, source_url, place_id, map_url, status, created_at, updated_at
```

The included row-level security policies allow anonymous CRUD access so the no-auth MVP can work from Expo Go. This is for development only. Before production, add authentication, add a `user_id` column, and replace the permissive policies with user-scoped policies.

If the Supabase URL or publishable key is missing, the app shows a cloud-configuration error and disables adding places. It never redirects saved-place operations to device-only storage.

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

## Instagram Import with Apify

The mobile app does not call Apify directly and never contains the Apify token. Instagram link import is routed through the Supabase Edge Function in `supabase/functions/instagram-import/index.ts`.

Set the Apify token only as a Supabase secret:

```bash
supabase secrets set APIFY_API_TOKEN=your-apify-api-token
```

Deploy the Edge Function:

```bash
supabase functions deploy instagram-import --project-ref your-project-ref
```

For local Edge Function testing:

```bash
supabase functions serve instagram-import --env-file supabase/.env.local
```

The function accepts:

```json
{ "url": "https://www.instagram.com/reel/..." }
```

It validates that the URL is a public Instagram post or reel URL, removes query params and fragments, calls Apify's `apify/instagram-scraper` Actor, and returns only the metadata the app needs for place extraction: caption, hashtags, mentions, owner name, timestamp, thumbnail URL, shortcode, and source URLs.

Limitations for the MVP:

- Only user-submitted public Instagram post and reel URLs are processed.
- The app does not scrape Instagram webpages, import Saved posts, or read DMs.
- Videos are not downloaded or rehosted.
- Engagement metrics are intentionally not stored.
- If Apify fails or returns no useful metadata, the app asks for a manual place search hint and keeps the save flow usable.

## Hong Kong Place Search Accuracy

Instagram import captures Apify metadata beyond captions, including tagged users, collaborators/coauthors, and location fields when Apify returns them. Development logging is sanitized: it reports whether a caption exists plus hashtags, mentions, tagged users, collaborators, and location text/coordinates, but it does not log API tokens or raw media URLs.

Place extraction now builds ordered search candidates from Instagram location name, tagged users, collaborators, caption mentions, caption place-name clues, and user hints. Usernames are converted into readable business-name queries and each query is geo-suffixed, defaulting to Hong Kong in development:

```text
EXPO_PUBLIC_DEFAULT_SEARCH_REGION=HK
```

The `place-search` Supabase Edge Function receives that geo context, appends `Hong Kong` when needed, sends `regionCode: "HK"`, `languageCode: "en"`, and a Hong Kong `locationBias` rectangle to Google Places Text Search. Set this Supabase secret only if you want to test stricter filtering later:

```bash
supabase secrets set GOOGLE_PLACES_USE_LOCATION_RESTRICTION=true
```

By default the function uses `locationBias`, not `locationRestriction`, so Google can still recover good nearby matches while avoiding Singapore-first results caused by server-region/IP bias.

## Future Integration Notes

- Keep `src/services/placeSearch/mockPlaceSearchService.ts` for offline development and use `EXPO_PUBLIC_PLACE_SEARCH_PROVIDER=google` when testing real Google Places matching.
- Replace `src/services/placeExtraction/mockPlaceExtractionService.ts` with a real AI provider when extraction is ready. Keep that provider behind a backend function so API keys are not exposed in Expo.
- Add Supabase auth and user-scoped saved-place policies before multi-user production testing.
- Add auth only after the local save flow and database schema are stable.


