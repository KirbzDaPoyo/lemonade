import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import type { PlaceTagRow, SavedPlaceRow } from '../src/lib/supabaseClient';
import {
  mapPlaceToRow,
  mapPlaceUpdateToRow,
  mapRowToPlace,
  mapTagRow
} from '../src/repositories/savedPlaces/SupabaseSavedPlacesRepository';
import {
  addUserTag,
  deleteUserTag,
  normalizeUserTag,
  suggestUserTags
} from '../src/services/tags/user-tags';

const savedPlaceRow = (overrides: Partial<SavedPlaceRow> = {}): SavedPlaceRow => ({
  id: 'place-id',
  name: 'Saved place',
  address: 'Address',
  area_or_city: 'Hong Kong',
  category: 'restaurant',
  cuisine_or_specialty: null,
  tags: ['legacy_generated_tag'],
  notes: null,
  source_url: 'https://www.instagram.com/p/example/',
  place_id: null,
  map_url: null,
  status: 'want_to_go',
  is_favorite: false,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
  ...overrides
});

test('user tags can be added and removed without a controlled vocabulary', () => {
  const added = addUserTag([], '  Quiet Patio  ');
  const removed = deleteUserTag(added, 'QUIET PATIO');

  assert.deepEqual(added, ['Quiet Patio']);
  assert.deepEqual(removed, []);
  assert.equal(normalizeUserTag('##  Personal Pick  '), 'Personal Pick');
});

test('user tag assignment is deduplicated case-insensitively', () => {
  assert.deepEqual(addUserTag(['Date Night'], 'date night'), ['Date Night']);
});

test('place search assigns no tags when the editable catalog is empty', () => {
  assert.deepEqual(suggestUserTags([], ['Coffee and pastries']), []);
});

test('place search suggests only matching tags from the editable catalog', () => {
  assert.deepEqual(
    suggestUserTags(
      ['Coffee', 'Date Night', 'Family', 'Outdoor'],
      ['A date-night coffee shop with outdoor seats']
    ),
    ['Coffee', 'Date Night', 'Outdoor']
  );
});

test('place search never creates an unknown tag from classification clues', () => {
  assert.deepEqual(
    suggestUserTags(['Favorite view'], ['ramen noodles with cocktails and pizza']),
    []
  );
});

test('existing saved tags are treated as user-created when user_tags is absent', () => {
  assert.deepEqual(mapRowToPlace(savedPlaceRow()).tags, ['legacy_generated_tag']);
  assert.deepEqual(
    mapRowToPlace(savedPlaceRow({ user_tags: ['My tag'] })).tags,
    ['My tag']
  );
});

test('repository inserts and assignments use user_tags without mutating the preserved column', () => {
  const place = mapRowToPlace(savedPlaceRow({ user_tags: ['My tag'] }));
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...newPlace } = place;
  const inserted = mapPlaceToRow({ ...newPlace, id: place.id });

  assert.deepEqual(inserted.tags, []);
  assert.deepEqual(inserted.user_tags, ['My tag']);
  assert.deepEqual(mapPlaceUpdateToRow({ tags: ['Edited'] }), { user_tags: ['Edited'] });
});

test('tag catalog rows map to editable domain tags', () => {
  const row: PlaceTagRow = {
    id: 'tag-id',
    name: 'Date Night',
    created_at: '2026-08-03T00:00:00.000Z',
    updated_at: '2026-08-03T00:00:00.000Z'
  };

  assert.deepEqual(mapTagRow(row), {
    id: 'tag-id',
    name: 'Date Night',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
});

test('initial user-tag migration remains non-destructive', () => {
  const migration = readFileSync(
    resolve('.', 'supabase/migrations/20260803053138_add_user_managed_tags.sql'),
    'utf8'
  );

  assert.match(migration, /user_tags text\[\] not null default '\{\}'/);
  assert.doesNotMatch(migration, /drop column/i);
});

test('catalog migration backfills current tags and supports global rename and delete', () => {
  const migration = readFileSync(
    resolve('.', 'supabase/migrations/20260803061740_create_editable_tag_catalog.sql'),
    'utf8'
  );

  assert.match(migration, /create table if not exists public\.place_tags/);
  assert.match(migration, /coalesce\(user_tags, '\{\}'::text\[\]\) \|\| coalesce\(tags, '\{\}'::text\[\]\)/);
  assert.match(migration, /update public\.saved_places saved_place\s+set user_tags/i);
  assert.match(migration, /function public\.rename_place_tag/);
  assert.match(migration, /function public\.delete_place_tag/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /grant select, insert, update, delete on public\.place_tags to anon/);
  assert.doesNotMatch(migration, /drop column/i);
});
