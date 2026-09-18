# Release 0.7 — Map and Nearby Library

## Status and baseline

Implementation began on 2026-09-15 from clean tag `v0.6.0`. Baseline: 128 tests passed and TypeScript passed. Version is now 0.7.0; runtimeVersion.policy remains appVersion. The hosted quota migrations and resolver are deployed, restricted Android Maps credentials are configured, and Android build 24 passed the owner walkthrough after the location-permission fix was delivered on the preview channel. The final prerelease build and GitHub publication are recorded below when complete.

Release 0.7 is accepted for Android prerelease distribution. Physical iOS behavior and publication of the privacy/terms drafts remain unverified.

## User experience

Library has a restrained Map entry using the existing authenticated stack. Map filters reuse `selectLibraryPlaces`, `libraryOptions` and `V2FilterRack`: search, status, favorites, tag, category and area/city. Map has independent transient filters, preserving the library's current filters and import/inbox/plan providers.

Opening the screen does not request coordinates or location. An explicit Show action accepts 1–20 eligible saved places. More than 20 requires refinement; missing Place IDs are counted separately. Loaded results remain distinct from pending filters, and a failed load preserves the prior successful display. Retry resolves only missing positions; explicit refresh can repeat all attempts. Pan, zoom, selection, radius and mode changes do not call the resolver.

Google markers and list rows share selection. Selection exposes normal details, saved Maps destination, directions and the existing add-to-plan screen (including its duplicate and capacity feedback). Nearby ordering uses local Haversine distance with stable saved-ID ties. Optional 1/3/5/10 km radius applies only to the loaded set. No routes, travel times or unsaved business discovery are requested.

The screen uses V2 controls, theme colors, safe-area spacing, 48dp controls, accessible labels/selected states and non-animated initial fitting. Android Back dismisses the keyboard and then selection before leaving. Native map attribution has no overlapping application controls. Compact list attribution uses Google Maps text. Web uses the list/external Maps fallback and never imports the native renderer.

## Architecture and changed files

| Purpose | Files |
| --- | --- |
| Route and integration | `app/(app)/map.tsx`, `app/(app)/_layout.tsx`, `src/navigation/types.ts`, `src/navigation/use-app-navigation.ts`, `src/screens/v2-home-screen.tsx` |
| Map and nearby presentation | `src/screens/map-library-screen.tsx`, `src/components/saved-map.native.tsx`, `src/components/saved-map.tsx`, `src/components/saved-map-types.ts`, `src/components/v2-filter-rack.tsx` |
| Transient state and pure behavior | `src/store/map-session-context.tsx`, `src/services/map-session.ts`, `src/services/map-library.ts`, `src/services/foreground-location.ts` |
| Backend | `supabase/functions/place-locations/index.ts`, `supabase/functions/_shared/placeLocations.ts`, `supabase/config.toml`, migration below |
| Privacy | analytics contract/adapter, error-monitoring adapter, Account screen, `web/index.html`, new `web/privacy.html` and `web/terms.html` drafts |
| Configuration | `app.config.js`, `app.json`, `.env.example`, `package.json`, `package-lock.json` |
| Verification | `tests/map-library.test.ts`, test harness timer globals, `script/verify-map-auth.cjs`, `script/verify-map-database.cjs`, `script/verify-map-native-config.cjs`, existing native DB runner integration |

The account-keyed provider owns a `MapSession` cache and coalesces identical in-flight scopes. Cache identity includes both saved-place and Google Place IDs. Entire responses are validated before cache writes. Only successful coordinates survive in memory; failed refresh results remain retryable. Account teardown clears the cache and ignores late responses. Screen teardown ignores late UI loads.

Location uses one `expo-location` foreground acquisition after an explicit action. Permission outcomes include coarse/precise, requestable denial, blocked, disabled services, timeout, stale/inaccurate and unavailable. Acquisition deadline is 15 seconds; accepted fixes must be at most two minutes old, with finite accuracy no worse than 10 km. Coarse results are accepted and labeled approximate. No watch/background/geofencing/foreground service API is called. A retained fix expires after two minutes and is cleared on screen teardown, app background, account switch or sign-out. Pending acquisition generations are invalidated when canceled. The native map does not receive device position or enable its user-location layer.

### Resolver

`place-locations` follows the established Clerk boundary (`verify_jwt = false` at the Supabase gateway; real signature/issuer/subject/role verification in `requireClerkUser`). The client checks its expected account subject before sending the token. Request body is only `{ ids: [...] }`, maximum 20 before deduplication, maximum 8 KiB parsed text. Arbitrary properties and malformed IDs are rejected.

Ownership is queried using the user token and RLS, plus an explicit verified `user_id` predicate. A batch containing any inaccessible ID fails generically before quota or Google, without revealing which ID exists. Unmappable owned rows consume no quota. A separate server-role client reserves allowance; it is never shipped to the app.

Google Place Details requests use exactly `X-Goog-FieldMask: id,location`, three workers, eight-second abort deadlines and **no automatic retry**. Responses contain only saved ID, validated latitude/longitude or a fixed failure category. Mismatched resource IDs are treated as moved. The exact minimal mask cannot detect every relocation where Google still returns an old resource/location; no extra relocation field is requested. Partial success is retained. Responses set `Cache-Control: no-store`; neither provider bodies nor raw errors are logged or returned.

### Quota migration and deletion

CLI-created migration: `supabase/migrations/20260915063806_add_map_position_quota.sql`.

`private.map_position_usage` contains UTC date, scope, subject (empty for global), attempts and update time. RLS is enabled with no client table privileges. The public `reserve_map_positions` RPC is SECURITY DEFINER with an empty search path and fixed qualification, revoked from PUBLIC/anon/authenticated and granted only to service_role. Input checks enforce 20/request, 60/user/day and 250/project/day. Server overrides `MAP_USER_DAILY_LIMIT` and `MAP_PROJECT_DAILY_LIMIT` only lower the ceilings, including zero to disable new attempts.

A fixed advisory transaction lock and locked global row serialize reservations. Both scopes reserve before any provider call. Provider failure does not refund a reservation; interrupted batches can conservatively count attempts that did not reach Google. This favors cost protection. Old rows earlier than today minus two dates are cleaned during reservations; no usage means no opportunistic cleanup until the next reservation.

`delete_current_user_data` retains invoker/RLS behavior and its two-count return signature. It calls a narrowly scoped private deletion helper deriving subject from `auth.jwt()`, removing only that user's quota rows. The helper has authenticated execution/schema usage solely to support this invoker call; it is in the **non-exposed private schema**, not a public RPC. The global counter and other users remain. Do not expose the private schema in Data API configuration. Export remains schema 4 and contains no quota counters or coordinates.

## Dependencies and native configuration

| Pinned package | Reason |
| --- | --- |
| react-native-maps 1.20.1 | Expo SDK 54 recommended native renderer; Google provider on both Android and iOS |
| expo-location 19.0.8 | SDK-compatible explicit one-shot foreground location |
| react-native-web 0.21.2 | Existing repository lacked the web runtime; needed for required web fallback/bundle validation |

All were installed through `npx expo install`; lockfile changes are local and uncommitted. No new hosted service is added. react-native-maps 1.20.1 uses React Native's New Architecture interop layer; SDK 54 explicitly recommends this version. Expo Doctor passes, but final compatibility is still subject to native/device verification.

Dynamic configuration preserves the development identifiers and existing plugins. Supply separate build-time `GOOGLE_MAPS_ANDROID_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY`; only availability booleans are placed in `extra.mapSdk`. These are compiled **client keys**, protected by platform/API restrictions, not server secrets. Never substitute `GOOGLE_PLACES_API_KEY`.

Android restrictions: Maps SDK for Android, exact package (`com.projectlemonade.mvp` or development `.dev`), and the signing SHA-1 for each approved build. iOS restrictions: Maps SDK for iOS and exact bundle identifier. Server Places key remains separate. Missing SDK keys show controlled unavailability; mock resolution and automated tests remain usable.

`EXPO_PUBLIC_MAP_RESOLVER=mock` selects clearly labeled deterministic synthetic positions; `real` uses the authenticated function. Do not present mock results as actual venue locations.

Configuration introspection confirms ACCESS_COARSE_LOCATION and ACCESS_FINE_LOCATION; iOS has only NSLocationWhenInUseUsageDescription. No always/background-location declaration or location foreground-service permission appears. Existing baseline internet/storage/overlay/vibration permissions remain; generated native projects were not rewritten. A new 0.7.0 binary is mandatory because native dependencies/permissions changed and the appVersion runtime differs from 0.6.0.

## Privacy and policy review

No coordinate, accuracy, distance, viewport, selected ID, search text or provider body is persisted by this feature. PostHog accepts fixed action/outcome/failure values; Sentry adds fixed operations and geographic-key scrubbing. Breadcrumbs are discarded, logs/replays/traces/profiles remain disabled, and permission denial is not recorded as an application error.

Google's renderer still communicates with Google for map content and can process map/network/device information under its policies. Local distance computation is not a promise that Google Maps is offline. Directions open the separate Maps app without passing a device origin.

Local privacy, terms and deletion drafts include Google's policy links and counter retention. They are **not published**. Publicly accessible, reviewed Terms and Privacy pages are a prerequisite to real-provider distribution. Confirm the billing account's region and applicable EEA/non-EEA terms during rollout; no billing-region assumption has been verified.

Official sources checked 2026-09-15:

- [Expo SDK 54 map-view](https://docs.expo.dev/versions/v54.0.0/sdk/map-view/) and [location](https://docs.expo.dev/versions/v54.0.0/sdk/location/).
- [react-native-maps 1.20.1 interop documentation](https://github.com/react-native-maps/react-native-maps/tree/v1.20.1).
- [Google Place Details fields](https://developers.google.com/maps/documentation/places/web-service/place-details): location triggers Essentials; id alone is not sufficient for coordinates.
- [Google pricing](https://developers.google.com/maps/billing-and-pricing/pricing): Maps SDK unlimited; Place Details Essentials 10,000 free monthly events, then USD 5/1,000 in the first paid band.
- [Google Places policies/attribution](https://developers.google.com/maps/documentation/places/web-service/policies) and [service terms, section 14](https://cloud.google.com/maps-platform/terms/maps-service-terms): Google maps for map display; latitude/longitude caching exception up to 30 days. This feature uses transient account-session memory only, never a durable cache.
- [Supabase functions security](https://supabase.com/docs/guides/database/functions) and [changelog](https://supabase.com/changelog). The Markdown changelog endpoint failed; HTML was available. Changes to automatic Data API grants reinforce explicit grants; no new public table is exposed here. Existing Clerk authentication is retained.

At 250/day, at most 7,750 reserved attempts fit in 31 days. This leaves 2,250 events below the listed 10,000 allowance **only if other activity does not consume that same SKU**. At the first paid rate, 7,750 additional events would be USD 38.75 if no free allowance remained. Existing usage, billing-region terms, Google hard quotas and restricted credentials are not verified. Budget alerts notify; they do not stop charges. No guaranteed-free claim is made.

## Verification evidence

| Check | Result |
| --- | --- |
| Baseline npm test / typecheck | 128 passed / passed |
| Final npm test | 142 passed, 0 failed |
| Final npm run typecheck | Passed |
| npx expo-doctor | 18/18 passed (final record below if changed) |
| Deno 2.9.6 check, new Edge Function | Passed; actual Deno/npm imports checked |
| Android production JS export | Passed; final output under dist/release-0.7-android |
| Web production export | Passed after adding Expo-compatible react-native-web; native renderer excluded |
| Native configuration introspection | Passed foreground-only assertions; no prebuild/native project mutation |
| Complete native PostgreSQL chain | All 17 migrations passed |
| Quota database checks | User/global boundaries, competing requests, shared cap, cleanup, privileges, deletion isolation passed |
| Existing inbox/plans database and signed HTTP regressions | Passed |
| Local Supabase security/performance advisors | No findings |
| Actual Clerk code with local RSA/JWKS and mocked Google | Signature/issuer/role/expiry/subject/cross-owner checks passed |
| Lint | Not configured; no lint pass claimed |
| Native compilation / physical Android / physical iOS | EAS Android build 24 installed; owner confirmed map, live positions, distances, radius filters and regression flow. Physical iOS not performed. |
| Hosted function | Deployed version 1; missing/invalid authorization both return 401 |
| Live provider | Authenticated owner flow passed on Android; positions resolved and displayed correctly |

Reproduce with `npm test`, `npm run typecheck`, `npx expo-doctor`, `npx expo export --platform android --output-dir dist/release-0.7-android`, and the equivalent web export. `npx expo config --type introspect --json > dist/release-0.7-native-config.json` followed by `node script/verify-map-native-config.cjs` checks native configuration without regenerating projects.

The existing `node script/verify-inbox-native.cjs` runner creates and stops a disposable PostgreSQL 17/PostgREST instance on localhost, applies the chain, runs map/inbox/plan tests and advisors. It uses the established temporary native PostgreSQL/pg/PostgREST installation, not production. `node script/verify-map-auth.cjs` uses temporary `jose@6.1.3` in TEMP/lemonade-map-validation. Deno command: `npx --yes deno@2.9.6 check --no-config --no-lock --node-modules-dir=none supabase/functions/place-locations/index.ts`. These validation tools are not app runtime dependencies.

Mock/automated UI evidence covers explicit load, pending filters, marker/list selection, modes, detail/plan callbacks, Back, account/cancellation cleanup and telemetry rejection. Existing MapButtons and plan tests cover external handoff, duplicates and capacity. The owner confirmed native map tile loading and the core touch flow on Android. TalkBack, large-text extremes and physical iOS remain unverified.

Installation reported 48 npm audit findings (35 moderate, 13 high) and existing Clerk/React peer-version warnings. No broad dependency upgrade or audit autofix was performed. Expo Doctor passed; audit findings are not represented as resolved. At inspection roughly 3 GB of disk remained and ADB was not on PATH. A native build requires separate authorization plus a usable SDK/toolchain/disk budget.

## Android acceptance checklist

1. Upgrade build 23 without losing authentication/data.
2. Open Map; verify no position request or location prompt.
3. Load 1–20 filtered eligible places explicitly.
4. Refine an over-20 scope; verify no silent subset.
5. Verify missing-Place-ID counts.
6. Select markers and rows; verify synchronized selected state.
7. Open normal details.
8. Add to an active plan; verify duplicate/full feedback.
9. Open saved destination and directions.
10. Pan/zoom; verify no new Place Details request.
11. Reopen/reload scope; verify session reuse.
12. Change filters; verify pending versus loaded scope.
13. Browse an area without location permission.
14. Deliberately request foreground location.
15. Verify approximate permission and labeled distances.
16. Deny and permanently deny; verify recovery/settings.
17. Disable services and retry after enabling them.
18. Verify ordering/radii and full-loaded-set recovery.
19. Verify no background location indicator/history.
20. Exercise partial errors and explicit retry using mock/local fixtures.
21. Exercise user/global quota messaging using safe fixtures.
22. Switch accounts during pending resolution/acquisition.
23. Sign out; verify state clears.
24. Restart; verify no location/coordinates restored from storage.
25. Verify light/dark/system appearance.
26. Verify narrow layout, large text, keyboard/Back, reduced motion and TalkBack.
27. Repeat library/inbox/import/source/plan/account/export regression flows.

The owner reported that the map renders correctly, live saved-place positions appear, foreground location produces distances, radius controls appear and filter correctly, and the regression pass succeeds. The permission-dialog lifecycle fix was delivered on the preview channel and is embedded in the final prerelease binary. The remaining specialized denial, accessibility and lifecycle edge cases above are not claimed as individually observed. Physical iOS maps and permissions remain unverified on this Windows host.

## Rollout and rollback

The hosted migrations, function, restricted Android Maps configuration, live owner check, EAS preview build and Android acceptance flow are complete. The final release step publishes the merged commit as the `v0.7.0` GitHub prerelease with its Android APK and checksum. Public privacy/terms publication and physical iOS acceptance remain future work.

Rollback: stop new map resolution by lowering the server caps to zero or disabling the function with authorization; distribute an approved compatible fix or revert to the prior binary. Retain the additive quota schema and compatible deletion procedure. Do not drop product tables or attempt a 0.7 OTA onto the 0.6 runtime. Cached positions are transient; sign-out/restart clears them. SDK restrictions and global cap remain defense layers, not a substitute for monitored usage.
## Developer quota exemption — 2026-09-17

The private map_position_quota_exemptions table and updated reservation function were deployed through migration add_map_quota_exemptions. The current project-owner Clerk subject was enrolled after explicit confirmation; no email address is stored. Exempt subjects bypass Lemonade's user and project reservation counters, while Google Places provider usage and billing still apply. The table has RLS enabled, no anon/authenticated table privileges or policies, and account deletion removes the subject's exemption.

The complete 17-migration native PostgreSQL chain passed. Hosted verification called the reservation function with both caps set to zero and received ok; the user and project attempt counters remained 53 before and after. Hosted advisors reported only the intentional INFO notices for private deny-by-default RLS tables without policies and the existing unused-index INFO notices.

## Final local checkpoint

Final 0.7.0 checks before publication: 142 tests passed, 0 failed; TypeScript passed; Expo Doctor 18/18; Android and web production exports passed after the final filters-only Map panel change; git diff --check passed after removing accidental blank lines. The shared filter rack keeps sort/density controls in the ordinary library and hides them for Map. The Deno check, 17-migration native PostgreSQL run, quota/auth fixtures and local advisors retain the evidence recorded above. Hosted rollout and Android device acceptance are recorded in the checkpoints below.

## Hosted rollout checkpoint — 2026-09-16

The owner authorized hosted migration, function deployment, restricted Android Maps configuration, a small live check, and Android build/device acceptance. The owner subsequently explicitly authorized one EAS Android preview build without a plan upgrade or purchased credits. Earlier next-authorization wording above describes the pre-rollout checkpoint and is superseded by this record.

- Hosted project: mrlumqsdabxptkwmqjwf. Inspected existing migration history before applying the additive migration.
- Migration add_map_position_quota applied as hosted version 20260916022758 (local source 20260915063806_add_map_position_quota.sql).
- Verified quota table RLS, no anon/authenticated table access, reserve execution restricted to service_role, deletion helper wiring, and zero initial quota rows.
- place-locations deployed ACTIVE version 1, custom Clerk verification enabled in handler, gateway verify_jwt=false as designed.
- Actual hosted HTTP checks: missing authorization 401; invalid bearer 401. No Google calls or account deletion used for these checks.
- Hosted security advisor: one INFO for quota table RLS without policies, intentional deny-by-default with no client table grants. Performance advisor: three INFO unused indexes on existing saved-place/plan tables. No warning/error findings.
- Existing EAS preview signing credentials verified for com.projectlemonade.mvp. SHA-1: 31:9C:E0:A5:3C:1F:00:93:6B:B4:4A:2F:42:02:99:C9:AA:BB:D9:D7. Credentials were not replaced or downloaded.
- Local Android SDK/ADB was unavailable, so the authorized EAS preview path produced Android build 24. The owner installed it and confirmed the map and live resolver. An OTA preview update fixed cancellation while Android's permission dialog temporarily backgrounds the app; the owner then confirmed distances and radius filtering.
- The final prerelease binary embeds that permission-dialog fix so fresh and offline installs do not depend on the earlier OTA update.

## Final Android prerelease artifact — 2026-09-17

- EAS build ID: `8f88112a-b5f3-46f4-8455-d7705db20e66`
- Source commit: `2c2a3e99f95bdeba62a6a516f015f0db3c608859`
- Version/build/runtime: `0.7.0` / `25` / `0.7.0`
- Distribution/channel: internal APK / `preview`
- EAS artifact: https://expo.dev/artifacts/eas/8X48VBvULZuMuj_e40nfao2oyYrIRLBGkwS0Mk9ofsQ.apk
- Release asset: `project-lemonade-0.7.0-android-build25.apk`
- SHA-256: `ff67b7e51cf76c2ed7b2da9bfccee913ecf120f9a2baa07404b33a0b3e12e861`

EAS completed the build successfully. This binary embeds the Android permission-dialog lifecycle fix that the owner verified through the preview-channel update on build 24.
