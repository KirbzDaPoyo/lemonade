# Release 0.4 — Library Discovery and Organization

Status: 0.4.0 internal Android build installed and standalone smoke test passed according to the owner. Automated checks passed. Individually unconfirmed acceptance coverage is listed below; GitHub release tracking uses feature/library-discovery-0.4 and prerelease tag v0.4.0.

## Behavior and boundaries

The active Expo Router home route still renders `src/screens/v2-home-screen.tsx`. Search, filters, sort controls and density extend the V2 theme and row component.

- Search is local to the hydrated private library. NFKD normalization, combining-mark removal, lowercase conversion and whitespace normalization produce tokens. Every token must match some persisted place or source field. Search covers name, area/city, address, cuisine/specialty, tags, notes, creator username, the first 280 Unicode code points of the caption excerpt, recommended items and vibe tags. URLs and raw provider responses are excluded.
- Status, favorite, one tag, category and area restrictions combine with search using AND. Category and area options derive from the complete current library using normalized keys. Missing options clear after hydration. Tag matching retains the existing normalized identity rules.
- Newest, oldest, recently updated and normalized name A–Z sorts use place ID as a deterministic final tie-breaker. Invalid dates sort as epoch zero. The selector never changes its input array. Search/filter selection precedes sorting.
- Search has a labeled input, native search return key, one-action clear, and result count. Empty library, no matches, initial loading and backend storage failures are distinct. Clearing filters preserves search, sort and density; clearing search preserves filters.
- Compact rows retain name, city, status, favorite and a one-line address. They use the same V2 component and theme, with less vertical padding and no glyph or tag strip. Controls retain 48dp minimum targets. Filter/sort dialogs scroll within safe-area bounds and close with Android Back; opening a dialog dismisses the keyboard. Modal animation respects reduced motion. The library has a bounded width on larger web surfaces.

## Persistence

`src/services/use-library-preferences.ts` uses existing Expo SecureStore on native and localStorage on web. A per-Clerk-user key isolates accounts; the encoded ID is a namespace, not encryption. Only sort and density enums are stored. No search, filter, place or source content is persisted by this feature.

Missing, malformed or invalid preferences fall back to newest/comfortable. Read failures use defaults. Write failures retain the session choice. Writes are serialized and stale reads cannot overwrite a newer choice. Account changes reset transient view state and read the new account's preferences.

## Privacy and cost

Existing PostHog adapters emit search-start once per mounted library/account session, generic filter type changes, sort/density enums and explicit filter clearing. No keystroke, query, filter value, result list, tag, area or source content enters these events. Preference errors send newly constructed generic errors and only `preference_read` or `preference_write` operation categories to the existing Sentry adapter; raw storage errors are not forwarded.

There are no new dependencies, environment variables, schema changes, migrations, provider requests or services. The existing test command includes the new suite. Only root application version metadata changed in the lockfile; dependency resolution and production backend configuration are unchanged. The owner authorized an internal Android EAS preview build. No EAS Update or store submission is planned.

## Automated validation — 2026-09-10

- Baseline `npm test`: 80 passed, 0 failed, 0 skipped.
- Baseline `npm run typecheck`: exit 0.
- Final `npm test`: 93 passed, 0 failed, 0 skipped.
- Final `npm run typecheck`: exit 0.
- `npx expo-doctor`: 18/18 checks passed; no issues detected.
- `npx expo export --platform android --output-dir dist/release-0.4`: successful production Android JavaScript export (Hermes bundle, 25 assets).
- `git diff --check`: passed after removing trailing blank lines.
- No lint script is configured. No database file changed, so additional schema/RLS checks were not needed.

Tests cover token/Unicode search, all searchable field groups, caption bounds, all filter groups, independent clearing, stable sorts and ties, a 5,000-place synthetic collection, preference parsing and hook read/write/account races, bounded analytics payloads, row component output, active route wiring and home callbacks. The existing Release 0.3 saving/source/detail and data-management tests remain in the full suite. Obsolete tag UI checks now inspect V2 files.

The TSX tests execute components with lightweight React/native host stubs. They verify output and callbacks, not real native rendering, keyboard behavior, accessibility focus, or pixel layout. No native visual review or web browser acceptance is claimed.

## Android acceptance — user-reported

The owner tested through the existing Expo development client connected to Metro and reported: "No unexpected behavior detected." The supplied checklist covered search fields, combined filters, no-results recovery, independent clearing, all sorts, compact density, restart persistence/reset, editing records, appearance, larger text, keyboard/Back and usual multi-source/add/save flows.

This is user-reported acceptance, not agent-observed device automation. No ADB or local SDK was required for this development-client testing. Exact phone model and OS were not recorded. Destructive account/deletion flows, explicit source-attachment ordering, screen-reader focus and responsive web inspection were not individually confirmed and are not claimed as passed.

The owner installed the standalone 0.4.0 preview APK (build 21). Before testing, the agent confirmed no listener on port 8081: Metro was stopped. The owner then reported: "Everything works as expected!" in response to the standalone checklist covering cold launch, existing library/sign-in, search and combined filters, sorting and compact rows, restart persistence of sort/density with search/filter reset, and opening/editing place details. These checks are recorded as user-reported passes.

## Version and distribution

Application versions in app.json, package.json and the lockfile are now 0.4.0. The existing preview EAS profile uses internal distribution, the preview environment/channel and automatic Android build-number increment.

The runtime policy remains appVersion. Version 0.4.0 creates runtime 0.4.0 and requires a compatible new binary; a 0.3 binary cannot receive an OTA targeting runtime 0.4.0. The owner authorized the internal EAS build after successful development-client testing. No production update, store submission or backend deployment is included.

## Next work

The standalone preview smoke test passed. The owner authorized publishing feature/library-discovery-0.4, merging it into master and establishing the merge commit as GitHub prerelease v0.4.0. The GitHub pull request and release provide the authoritative commit and publication records. Retain the individually unconfirmed coverage above as follow-up checks; do not interpret the smoke test as exhaustive acceptance. For Release 0.5, prioritize concrete usability feedback before expanding organization or adding pagination.

## Internal EAS build

The owner authorized this preview build. All 93 tests, TypeScript, Expo Doctor (18/18), Android export and diff checks passed again with version 0.4.0.

- Build ID: c4c13de9-7064-4771-bdd8-15ab0dd8d3f6
- Profile: preview; Android internal distribution
- App version: 0.4.0; Android versionCode: 21 (remote increment from 20)
- EAS reused the existing Android signing keystore and preview environment.
- EAS created the preview update channel/branch while preparing the configured profile. No OTA update was published.
- Build page: https://expo.dev/accounts/land-of-poyo/projects/project-lemonade/builds/c4c13de9-7064-4771-bdd8-15ab0dd8d3f6
- The owner confirmed installation and successful standalone phone smoke testing. The agent did not retrieve a final EAS status after submission; installation is confirmed by the owner.

The CLI emitted a non-fatal Metro validation warning for watcher.unstable_workerThreads. Upload and submission succeeded; no dependency or configuration change was made for that warning.
