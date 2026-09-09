import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { normalizeInstagramSourceUrl } from '../src/services/incomingShare/instagramUrl';
import {
  createPlaceSourceDraft,
  SOURCE_CAPTION_MAX_LENGTH
} from '../src/services/place-sources/source-metadata';
import { getSourceThumbnailState } from '../src/services/place-sources/source-thumbnail';
import type { PlaceExtractionResult } from '../src/types/extraction';
import type { InstagramImportResult } from '../src/types/instagramImport';

const migration = readFileSync(
  'supabase/migrations/20260908010000_add_saved_place_sources.sql',
  'utf8'
);
const ownershipIndexMigration = readFileSync(
  'supabase/migrations/20260908020000_index_saved_place_source_ownership.sql',
  'utf8'
);
const repository = readFileSync(
  'src/repositories/savedPlaces/SupabaseSavedPlacesRepository.ts',
  'utf8'
);
const detailScreen = readFileSync('src/screens/v2-place-detail-screen.tsx', 'utf8');
const candidateScreen = readFileSync('src/screens/v2-candidate-match-screen.tsx', 'utf8');
const addScreen = readFileSync('src/screens/v2-add-place-screen.tsx', 'utf8');

test('Instagram source identity ignores harmless URL variants', () => {
  assert.equal(
    normalizeInstagramSourceUrl(' https://instagram.com/reels/AbC_123/?utm_source=share#fragment '),
    'https://www.instagram.com/reel/AbC_123/'
  );
  assert.equal(
    normalizeInstagramSourceUrl('https://www.instagram.com/p/Post-42?igsh=abc'),
    'https://www.instagram.com/p/Post-42/'
  );
});

test('source metadata is allowlisted, normalized, and bounded before persistence', () => {
  const source = createPlaceSourceDraft({
    fallbackUrl: 'https://instagram.com/reel/Fallback/',
    instagramImport: {
      sourceUrl: 'https://instagram.com/reels/Source42/?igsh=secret',
      inputUrl: 'https://instagram.com/reels/Source42/',
      hashtags: [],
      mentions: [],
      taggedUsers: [],
      collaborators: [],
      ownerUsername: '@@Creator',
      caption: '  ' + 'Lemon '.repeat(100),
      productType: 'clips',
      rawType: 'reel',
      thumbnailUrl: 'http://insecure.example/thumbnail.jpg',
      timestamp: 'not-a-date'
    } as InstagramImportResult,
    extraction: {
      recommendedItems: Array.from({ length: 12 }, (_, index) =>
        ` Item ${index} ${'x'.repeat(100)} `
      ),
      vibeTags: ['manual-search', ...Array.from({ length: 12 }, (_, index) => `Vibe ${index}`)]
    } as PlaceExtractionResult
  });

  assert.equal(source.sourceUrl, 'https://www.instagram.com/reel/Source42/');
  assert.equal(source.shortcode, 'Source42');
  assert.equal(source.mediaType, 'reel');
  assert.equal(source.creatorUsername, 'Creator');
  assert.equal(Array.from(source.captionExcerpt ?? '').length, SOURCE_CAPTION_MAX_LENGTH);
  assert.equal(source.recommendedItems.length, 8);
  assert.ok(source.recommendedItems.every((item) => Array.from(item).length <= 80));
  assert.equal(source.vibeTags.length, 8);
  assert.equal(source.vibeTags.includes('manual-search'), false);
  assert.equal(source.thumbnailUrl, undefined);
  assert.equal(source.publishedAt, undefined);
  assert.deepEqual(Object.keys(source).sort(), [
    'captionExcerpt',
    'creatorUsername',
    'mediaType',
    'platform',
    'publishedAt',
    'recommendedItems',
    'shortcode',
    'sourceUrl',
    'thumbnailUrl',
    'vibeTags'
  ]);
});

test('missing and failed expiring thumbnails use the explicit fallback state', () => {
  assert.equal(getSourceThumbnailState({}, false), 'fallback');
  assert.equal(
    getSourceThumbnailState({ thumbnailUrl: 'https://images.example/temporary.jpg' }, false),
    'image'
  );
  assert.equal(
    getSourceThumbnailState({ thumbnailUrl: 'https://images.example/temporary.jpg' }, true),
    'fallback'
  );
});

test('saved source schema enforces per-user identity, ownership, bounds, RLS, and cascade', () => {
  assert.match(migration, /create table public\.saved_place_sources/i);
  assert.match(
    migration,
    /constraint saved_place_sources_user_source_unique unique \(user_id, source_url\)/i
  );
  assert.match(
    migration,
    /foreign key \(saved_place_id, user_id\)[\s\S]*references public\.saved_places \(id, user_id\)[\s\S]*on delete cascade/i
  );
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /for select[\s\S]*auth\.jwt\(\)[\s\S]*user_id/i);
  assert.match(
    migration,
    /for insert[\s\S]*with check[\s\S]*saved_place\.user_id = \(\(select auth\.jwt\(\)\) ->> 'sub'\)/i
  );
  assert.match(migration, /grant select, insert on public\.saved_place_sources to authenticated/i);
  assert.doesNotMatch(
    migration,
    /grant[^;\n]*(?:update|delete)[^;\n]*on public\.saved_place_sources/i
  );
  assert.match(migration, /is_bounded_text_array\(recommended_items, 8, 80\)/i);
  assert.match(migration, /is_bounded_text_array\(vibe_tags, 8, 40\)/i);
  assert.match(migration, /caption_excerpt[\s\S]*char_length\(caption_excerpt\) <= 280/i);
  assert.doesNotMatch(migration, /raw_(?:payload|json)|provider_payload|media_blob/i);
  assert.match(
    ownershipIndexMigration,
    /saved_place_sources_owned_place_idx[\s\S]*\(saved_place_id, user_id\)/i
  );
});

test('backfill and atomic RPC cover all outcomes without mutating existing places', () => {
  const rpc =
    migration.match(
      /create or replace function public\.save_place_with_source[\s\S]*?comment on function public\.save_place_with_source/
    )?.[0] ?? '';

  assert.match(migration, /insert into public\.saved_place_sources[\s\S]*from public\.saved_places/i);
  assert.match(migration, /on conflict \(user_id, source_url\) do nothing/i);
  assert.match(rpc, /security invoker/i);
  assert.match(rpc, /'created_place'/);
  assert.match(rpc, /'attached_source'/);
  assert.match(rpc, /'existing_source'/);
  assert.match(rpc, /exception when unique_violation/i);
  assert.match(
    rpc,
    /if inserted_source_place_id is null then[\s\S]*if created_place_id is not null then[\s\S]*delete from public\.saved_places/i
  );
  assert.doesNotMatch(rpc, /update public\.saved_places|update public\.saved_place_sources/i);
});

test('repository batches source hydration and saves through the atomic RPC', () => {
  assert.match(repository, /const \[placesResult, sources\] = await Promise\.all/i);
  assert.match(repository, /this\.listSources\(\)/);
  assert.match(repository, /new Map<string, PlaceSource\[\]>/);
  assert.match(repository, /rpc\('save_place_with_source'/);
  assert.match(repository, /isSaveOutcome/);
});

test('active detail and save UI expose source states and distinct outcomes', () => {
  const activeRoute = readFileSync('app/(app)/place/[placeId].tsx', 'utf8');

  assert.match(
    addScreen,
    /instagramImportProvider\.importUrl[\s\S]*?source = createPlaceSourceDraft\([\s\S]*?instagramImport[\s\S]*?placeExtractionService\.extractPlace/
  );
  assert.match(activeRoute, /V2PlaceDetailScreen/);
  assert.match(detailScreen, /Sources \/ \{place\.sources\.length\}/);
  assert.match(detailScreen, /place\.sources\.map/);
  assert.match(detailScreen, /SourceCard/);
  assert.match(detailScreen, /No source details/);
  assert.match(detailScreen, /instagramSourceOpened/);
  assert.match(candidateScreen, /created_place/);
  assert.match(candidateScreen, /attached_source/);
  assert.match(candidateScreen, /existing_source/);
  assert.match(candidateScreen, /placeSaveCompleted/);
});
