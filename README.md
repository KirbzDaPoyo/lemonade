# Project Lemonade

An MVP Expo app for saving cafes, restaurants, and vendors discovered from Instagram reels or posts.

The MVP is intentionally based on user-initiated sharing or pasting. It stores the original Instagram URL and lets the user confirm a place from a mock place-search provider. It does not scrape Instagram, import Saved posts, read DMs, or call Instagram APIs.

## What is included

- Saved Places list with status and category filters
- Add Place screen for an Instagram URL, place name, optional caption text, and notes
- Mock place-search service that returns candidate matches
- Candidate confirmation flow
- Place Detail screen with source URL, map URL, tags, notes, and status updates
- Local persistence for saved places using Expo-compatible AsyncStorage
- TypeScript domain models and service interfaces designed for a future Google Places or Supabase integration

## Setup

Install dependencies:

```bash
npm install
```

This includes `@react-native-async-storage/async-storage` for local saved-place persistence.

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
  storage/                 Local persistence adapter for saved places
  store/                   In-memory saved places state
  types/                   Domain types for place cards and filters
  utils/                   Display labels and formatting helpers
```

## Future Integration Notes

- Replace `src/services/placeSearch/mockPlaceSearchService.ts` with a Google Places provider that implements `PlaceSearchService`.
- Replace `src/storage/placesStorage.ts` with a Supabase-backed repository when account sync is needed.
- Add auth only after the local save flow and database schema are stable.
