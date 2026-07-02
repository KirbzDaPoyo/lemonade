# Project Lemonade

An MVP Expo app for saving cafes, restaurants, and vendors discovered from Instagram reels or posts.

The MVP is intentionally based on user-initiated sharing or pasting. It stores the original Instagram URL and lets the user confirm a place from a mock place-search provider. It does not scrape Instagram, import Saved posts, read DMs, or call Instagram APIs.

## What is included

- Saved Places list with status and category filters
- Add Place screen for an Instagram URL, place name, optional caption text, and notes
- Mock place-search service that returns candidate matches
- Candidate confirmation flow
- Place Detail screen with source URL, map URL, tags, notes, and status updates
- TypeScript domain models and service interfaces designed for a future Google Places or Supabase integration

## Setup

Install dependencies:

```bash
npm install
```

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
  screens/                 Home, Add Place, Candidate Match, Place Detail
  services/placeSearch/    Provider interface and mock implementation
  store/                   In-memory saved places state
  types/                   Domain types for place cards and filters
  utils/                   Display labels and formatting helpers
```

## Future Integration Notes

- Replace `src/services/placeSearch/mockPlaceSearchService.ts` with a Google Places provider that implements `PlaceSearchService`.
- Move the in-memory store in `src/store/PlacesContext.tsx` behind a repository interface before adding Supabase persistence.
- Add auth only after the local save flow and database schema are stable.
