# Release 0.3 - Source-aware saved places

Implementation date: 2026-09-08
App version: `0.3.0`
Migrations:
- `supabase/migrations/20260908010000_add_saved_place_sources.sql`
- `supabase/migrations/20260908020000_index_saved_place_source_ownership.sql`

## Outcome

A saved place can now retain multiple Instagram posts or reels as separate source references. Saving is handled by one database RPC and produces one of three explicit outcomes:

- `created_place`: a new place and its first source were created.
- `attached_source`: the place already existed and a new source was attached.
- `existing_source`: that canonical source URL was already saved for the user.

An existing place is never silently overwritten when another source is attached. The active V2 detail screen shows the source count, creator/type/date metadata when present, bounded recommendations and vibe tags, a thumbnail with a failure fallback, and a direct Instagram action.

## Data model and provenance

`saved_place_sources` is additive to the existing `saved_places` model. Every source row carries both `saved_place_id` and the Clerk JWT `user_id`. A composite foreign key ensures a source can only reference a place owned by the same user, and `ON DELETE CASCADE` removes all sources when the place or account data is deleted.

Per-user source identity is `(user_id, source_url)`. Supported Instagram post and reel URL variants are canonicalized before uniqueness is evaluated. The migration backfills one minimal source reference from each current saved place and uses conflict handling for canonical duplicates.

Only this allowlist is persisted from the existing Instagram import response:

- canonical source URL, shortcode, post/reel type
- creator username
- caption excerpt, limited to 280 Unicode characters
- up to eight recommended items of 80 characters each
- up to eight vibe tags of 40 characters each
- HTTPS thumbnail URL and publication timestamp

Raw Apify responses, full captions, media files, authentication material, and new Google Places response fields are not stored. The feature makes no additional Apify or Google request; it reuses metadata already returned by the existing import and matching flow.

## Authorization and concurrency

The table has RLS enabled. Authenticated users can select their own sources and insert a source only for a place they own. Direct update and delete table privileges are not granted. Database constraints repeat the URL, caption, array, and thumbnail bounds so a client cannot bypass the application sanitizer.

`save_place_with_source(jsonb, jsonb)` is a `security invoker` function that derives ownership from `auth.jwt()->>'sub'`. It checks source identity first, reuses an existing place by provider place ID, and handles uniqueness races. If a concurrent source insert wins after this transaction created a candidate place, the losing transaction deletes its unreferenced candidate before returning `existing_source`.

The implementation follows current Supabase guidance to combine explicit table grants with RLS, use separate operation policies, and prefer invoker functions. Both migrations were exercised successfully against the linked app project's PostgreSQL 17 schema.

## Read, export, deletion, and observability

Place hydration reads places and all of the user's sources in two parallel queries, then groups sources in memory. It does not issue one source query per place.

Export schema version 2 includes the bounded stored source fields. Account deletion retains its established RPC signature: deleting saved places cascades to source rows inside the same transaction.

PostHog records only bounded outcome/platform/type values for source saves and opens. Source URLs, captions, creator names, place names, addresses, and recommendations are excluded. Sentry continues to receive only scrubbed operation/category context.

## Deployment and mixed-version order

Apply the database migration before releasing the 0.3 app. The 0.3 client depends on the new table and `save_place_with_source` RPC. The migration is additive and the legacy `saved_places` columns remain intact, so a 0.2 binary can continue its existing reads and writes while clients are mixed. A source created by a 0.2 write during that window will remain only in the legacy `saved_places.source_url` field until a follow-up backfill is run.

`app.json` uses `runtimeVersion.policy = "appVersion"`. Bumping the app from 0.2.0 to 0.3.0 therefore creates a new Expo runtime. Existing 0.2 binaries cannot receive a 0.3 OTA update. Distribution requires a new 0.3 native binary before any 0.3 EAS Update can reach devices.

Safe rollout order:

1. Back up and test the target database.
2. Apply the 0.3 migration and run two-user RLS plus concurrency checks.
3. Confirm the 0.2 app still reads and writes its legacy flow.
4. Build and install a 0.3 development/preview binary.
5. Run Android acceptance, then release the 0.3 binary.
6. Publish an OTA only to the 0.3 runtime if a later JavaScript-only correction is needed.

Rolling the app back to 0.2 does not require dropping the additive source table. Do not destructively roll back the migration after users have accumulated source history.

## Verification record

Completed locally:

- `npm test`: 80 tests passed, 0 failed.
- `npm run typecheck`: passed.
- `npx expo-doctor`: 18/18 checks passed.
- Android production JavaScript export: passed; the temporary export artifact was removed after verification.
- Static regression coverage verifies canonicalization, metadata bounds, missing/failed thumbnails, schema ownership and RLS clauses, backfill, atomic outcome branches, concurrency cleanup, two-query hydration, active V2 source states, distinct save messages, export v2, deletion cascade, and privacy allowlists.
- The linked app database applied `add_saved_place_sources` and `index_saved_place_source_ownership` successfully.
- Backfill produced 33 source rows for 33 existing places.
- Live checks passed all three save outcomes, cross-user invisibility and association rejection, deletion cascade, and simultaneous duplicate-save cleanup with zero orphan rows.
- Supabase security advisor returned zero findings; the foreign-key performance finding was resolved with the follow-up ownership index.
- No provider call, Edge Function deployment, EAS build, OTA publication, or paid-resource action was performed.

Still required before release:

- Verify a 0.2 binary against the migrated schema.
- Run the full Android flow for zero, one, and multiple sources, repeat-save messaging, new-source attachment, thumbnail failure, export, place deletion, and account deletion.
- Physical iOS, accessibility, signing, store submission, and production rollout remain separate release gates.
