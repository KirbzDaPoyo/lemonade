# Release 0.6 — Outing plans and map handoff

## Status and baseline

Release 0.6.0 preview build 23 is installed and owner-tested. The agreed walkthrough has 19 passes and one explicitly skipped Maps fallback device check. Hosted migrations are applied. Earlier pending-check/build statements below are historical checkpoints, superseded by the acceptance entries and prerelease preparation at the end.

Starting point: clean worktree at `v0.5.0`; application/package version 0.5.0 and 108 passing tests. Baseline typechecking failed because its broad glob included ignored `dist/eas-0.5-upload-check/supabase/functions` copies of Deno code. Excluding generated `dist` fixed that boundary without changing the Edge Functions. No applicable repository/ancestor AGENTS.md was found. Existing generated Android code is untracked; it was not regenerated.

## Implemented experience

- Library retains its primary position and adds Plans with the active-plan count when nonzero.
- Separate active/completed lists; create, rename, complete, reopen, and confirmed delete. Titles trim whitespace and allow 1–80 Unicode code points.
- Add from saved-place detail or the plan's searchable private-library picker. Search reuses the Release 0.4 selector; it makes no provider calls. Duplicate/full feedback is explicit, with a database maximum of 20 members.
- Compare saved name, area, category, specialty, lifecycle, favorite, tags, and note presence. Open details, remove membership, open Maps, or request directions. Removing a member never deletes its saved place.
- Pick for me uses only hydrated members, excludes skipped places unless explicitly included, explains empty/all-skipped/one-eligible cases, and offers open, directions, pick again, and dismissal. The result is transient; there is no reveal animation or persisted recommendation.
- Maps URLs use `api=1`, human-readable destination and stored Place ID when available, proper encoding, a 2,048-character ceiling, validated stored map fallback where applicable, and name/address fallback. Directions leave origin unspecified. Unavailable information and opening failures have explicit states.
- Plan writes retain the last confirmed state until persistence succeeds. Failed title edits retain the draft and can be retried. Successful persistence followed by refresh failure shows a refresh action. There is no optimistic membership rollback to reconcile.
- Title editing sits above the shortlist. Android Back dismisses the keyboard, then closes a picker or confirms abandoning a dirty title. Inbox Back similarly dismisses the keyboard and confirms abandoning pasted links; active import state is retained.

## Architecture and database

CLI-created migration: `supabase/migrations/20260912132149_add_dining_plans.sql`, created with the installed `npx --no-install supabase migration new add_dining_plans` command after reading its help.

`dining_plans` stores UUID identity, Clerk text owner, bounded title, active/completed status, consistent completion timestamp, and creation/update timestamps. `dining_plan_items` stores identity, owner, plan reference, saved-place reference, and creation timestamp. No provider metadata is copied. Membership is ordered by creation timestamp and identity; no manual reordering is exposed. Plan ordering is active first, descending update/completion timestamp, then deterministic ID.

Composite foreign keys enforce same-owner plan/place relationships and cascade member cleanup on plan or saved-place deletion. A unique plan/place constraint rejects duplicates. A SECURITY INVOKER insert trigger updates/locks the owning plan before checking capacity. This serializes competing inserts, including direct Data API writes; repeatable-read conflicts abort instead of accepting stale counts. No SECURITY DEFINER code was added.

Both tables have RLS with the established `((select auth.jwt())->>'sub')` expression. PUBLIC/anonymous permissions are revoked, authenticated grants are explicit and column-limited, and select/insert/update/delete policies are separate where supported. Owners and identities cannot be reassigned; memberships cannot be updated in place. Functions have empty search paths and authenticated execution grants. Parent/member lookup indexes are included.

A dedicated repository maps nested rows into domain objects. A dedicated client validates token subjects against its account, and the provider is keyed by Clerk identity. Generation/revision guards prevent late reads or mutations from hydrating a later account. Creation retains a retry identity; duplicate creation confirms the existing owned row and applies retained title intent. Plans use authenticated Data API access, with no new Edge Functions, subscriptions, jobs, or services.

## Export, deletion, privacy, cost

Schema 4 adds `data.diningPlans`: identity, title, status, completion/creation/update timestamps, and ordered `placeIds`. Existing saved-place/source/tag/inbox fields remain intact. Export checks that the account is still current before sharing. The authenticated deletion RPC deletes plans (cascading memberships) while retaining its existing two-count return signature for older clients. Account and static deletion copy include plans.

Analytics adds `plan_action` with fixed actions `created`, `place_added`, `place_removed`, `picker_used`, `completed`, `reopened`, and `map_handoff_opened` with `map`/`directions`. Both adapters reject values outside their fixed action lists. No plan/place identifiers, titles, names, addresses, URLs, results, notes, tags, search text, timestamps, or counts are emitted by these events. Sentry uses fixed `plan_storage`/`storage` context and fixed errors; its scrubber now also removes plan/title keys and existing response content.

No dependencies added or removed, no new environment variables, no dashboard configuration, and no paid service activated. Storage grows only by small plan/member rows. Reads occur on hydration/focus/explicit refresh and after mutations; no provider lookups or background polling were added. All-skipped selection and random choice are local computation; optional existing telemetry remains bounded. Maps handoff does not call Places, request location permission, or mutate saved data.

References checked: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) and [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). The Supabase changelog Markdown fetch was attempted but unsupported by the web fetcher. Existing installed CLI help and repository patterns supplied version-specific command evidence.

## Automated verification

| Command/check | Observed result |
| --- | --- |
| Baseline `npm test` | 108 passed, 0 failed |
| Final `npm test` | 128 passed, 0 failed, 0 skipped |
| `npm run typecheck` | Passed, no diagnostics |
| `npx expo-doctor` | 18/18 checks passed |
| `npx expo export --platform android --output-dir dist/release-0.6-android` | Passed; one production Hermes bundle, 6.89 MB, metadata and assets |
| `node script/verify-inbox-native.cjs` | 15 migrations executed on disposable native PostgreSQL 17; inbox regressions, plan DB checks, and both signed HTTP repository fixtures passed |
| Local `supabase db advisors --db-url ...?sslmode=disable --type all` | Passed: zero findings on the disposable local database |
| `git diff --check` | Passed after trailing whitespace/line-ending cleanup |
| Lint | No lint script configured; not claimed as passed |

The local runner uses the existing temporary PostgreSQL 17.10, pg, and PostgREST installation outside app dependencies, a disposable database bound to localhost, and random fixture-only JWT signing. It stops both servers in finally blocks. The CLI's generic “Connecting to remote database” message refers to the explicitly supplied 127.0.0.1 URL; no hosted database was contacted.

The first advisor pass identified seven new auth RLS initialization warnings. Moving claim extraction outside the scalar JWT subquery, matching the existing inbox migration, resolved all seven; the complete migration/database/API suite was rerun and passed. This local advisor result does not substitute for post-rollout hosted advisors.

Database coverage includes independent grants and RLS, anonymous denial, all plan lifecycle operations, cross-account read/add/rename/complete/reopen/delete denial, cross-owner places, immutable ownership, Unicode/title/status bounds, duplicate and final-capacity races, repeatable-read conflict, member/plan/place cascades, and account-deletion isolation. Races wait for `pg_blocking_pids` evidence before releasing the first transaction. HTTP tests exercise the actual Supabase repositories and idempotent create path using two signed identities. This verifies PostgREST JWT enforcement, not hosted Clerk issuance.

Application tests cover domain and URL boundaries, mapping, failure/retry, stale requests, account switching, title preservation, both membership entry points, disabled duplicate/full feedback, picker states, confirmed deletion, keyboard-before-discard behavior, Maps opening success/failure, schema 4, and privacy scrubbing. Component harness tests are deterministic callback/render checks, not a native renderer or accessibility audit.

Logs are ignored local artifacts under `dist/release-0.6-{tests,database,advisors,doctor,export,diff-check}.log`.

## Device acceptance — all pending for 0.6

No agent-observed or owner-reported 0.6 device evidence exists. ADB is absent from PATH and the standard Android SDK/ADB locations do not exist. Local native compilation, emulator rendering, and device interaction were therefore unavailable. No APK was installed. Release 0.5 owner acceptance remains historical evidence only.

1. Upgrade from installed 0.5.0 build 22; preserve saved data and authentication.
2. Create, rename, complete, reopen, and confirm deletion of a plan.
3. Add from place detail and from the searchable plan picker.
4. Attempt duplicate membership; verify one member and clear feedback.
5. Fill to 20 using safe fixtures and reject item 21.
6. Remove a member while preserving its saved place.
7. Delete a saved place; verify other plan members remain valid.
8. Exercise empty, single eligible, ordinary, all-skipped, and include-skipped picks.
9. Check reduced motion; picker result must remain understandable with no animation.
10. Open saved place and directions in Google Maps.
11. Exercise missing-Place-ID and unavailable-information fallbacks, plus opening failure/retry.
12. Restart and verify plan persistence.
13. Switch Clerk accounts and verify isolation during outstanding work.
14. Export schema 4 and inspect membership; separately verify authenticated account deletion on disposable accounts.
15. Exercise offline create/rename/add/remove and explicit recovery without losing drafts.
16. Check light, dark, and system appearance.
17. Check largest text, narrow layout, keyboard dismissal/Back order, safe areas, focus, and TalkBack labels/status/result announcements on plan and inbox screens.
18. Repeat Release 0.4 library and Release 0.5 inbox/import/source/account regression scenarios.

Larger-text code improvements and deterministic Back tests address part of the 0.5 debt, but actual keyboard ordering, text layout, and TalkBack verification remain open. They are not marked as passes. iOS native behavior is also unverified.

## Changed files by purpose

- Domain/persistence: `src/types/dining-plan.ts`, `src/repositories/plans/plans-repository.ts`, `src/store/plans-context.tsx`, and the migration above.
- Screens/navigation: `src/screens/plans-screen.tsx`, `app/(app)/plans.tsx`, `app/(app)/plan/[planId].tsx`, `app/(app)/_layout.tsx`, `src/navigation/{types,use-app-navigation}.ts`, `src/screens/v2-{home,place-detail,inbox}-screen.tsx`, `src/components/v2-controls.tsx`.
- Maps: `src/services/map-handoff.ts`, `src/components/map-buttons.tsx`.
- Privacy/data: `src/observability/{analytics-contract,analytics,error-monitoring}.ts`, `src/services/export/{place-data-export,share-place-data-export}.ts`, `src/screens/AccountScreen.tsx`, `web/index.html`.
- Verification: `tests/dining-plans.test.ts`, updated data-export/import-inbox/library-view tests, `script/verify-plans-{database.cjs,api.ts}`, extended `script/verify-inbox-native.cjs`, `tsconfig.json`.
- Release: `app.json`, `package.json`, `package-lock.json`, README, and this record.

## Rollout and rollback

1. Review this local diff and pending device requirements. No Git commit/push/PR/tag/release has been created.
2. **Completed with owner authorization:** applied the outing-plan migration and follow-up index to the existing hosted Supabase project; hosted grants/RLS and advisors were checked. Existing 0.5 clients remain compatible with the additive tables and unchanged deletion return signature.
3. Separately authorize preparing/distributing a 0.6.0 preview binary (prefer restored local Android tooling; EAS requires explicit approval). No native dependency changed, but `runtimeVersion.policy` remains `appVersion`, so runtime 0.6.0 cannot update the installed 0.5.0 binary by OTA.
4. Separately authorize installation on the owner's device; execute and record the checklist above before calling Release 0.6 accepted.
5. Public deletion page publication, any OTA publication, commits/pushes, and releases each remain subject to separate authorization.

Rollback can retain the additive schema and return to the prior client, preserving plan rows for later recovery. The prior client's schema-3 export will not include plans; do not use it as a complete backup of 0.6 data. Do not drop the new tables as an automatic rollback.

Deferred scope: collaboration, public links, live data/maps, routing/location APIs, reservations, calendar/reminders, push, rankings/AI, journals, localization, payments, and store submission. No partial implementation of those features is included.

## Authorized hosted rollout — 2026-09-12

The owner explicitly authorized applying the Supabase migration. The existing app URL and Supabase plugin project listing both identified project `mrlumqsdabxptkwmqjwf`. Preflight confirmed the prior release migrations, required saved-place composite key, and absence of plan tables.

Applied through the Supabase plugin:

| Local migration | Hosted migration version | Result |
| --- | --- | --- |
| `20260912132149_add_dining_plans.sql` | `20260912140840` | Applied successfully |
| `20260912140936_index_dining_plan_membership_owner.sql` | `20260912140955` | Applied successfully |

The follow-up migration adds the `(plan_id, user_id)` foreign-key index identified by hosted performance advisors. Original migration history remains intact. Plugin-assigned timestamps differ from local CLI-created filenames, as they do for earlier releases; do not blindly reapply these migrations through CLI push without reconciling history.

Read-only hosted catalog verification confirmed both tables have RLS, seven ownership policies, anonymous denial, column-limited authenticated grants, owner-update denial, unique membership, composite same-owner cascade foreign keys, status/title/timestamp constraints, invoker functions with fixed search paths, and plan inclusion in the account-deletion function. No real user records were created, edited, or deleted for verification, and the deletion function was not invoked against hosted user data.

Final hosted security advisors: no findings. Final performance advisors: only six unused-index INFO notices (four new plan indexes and the two pre-existing saved-place indexes); no missing-index finding remains. New indexes have no production workload yet and were retained. [Supabase unused-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

Next authorization is for preparing/distributing a 0.6.0 preview binary, followed by separately authorized owner-device installation and acceptance. Device checks remain pending. No EAS build/update, Git commit/push, release, or website publication was performed.

After the index follow-up, all 15 local migrations, database/concurrency checks, both signed HTTP fixtures, and local advisors passed again. git diff --check passed.

## Owner device acceptance — 2026-09-14, first pass

The owner reported that the authorized 0.6.0 build finished and was installed, then explicitly confirmed that walkthrough checks 1–9 passed. These are owner-reported results, not agent-observed device evidence:

1. Upgrade retained authentication, saved places, tags, notes, and inbox.
2. Plan creation and rename worked.
3. Adding from place detail and the searchable plan picker worked.
4. Duplicate membership produced the expected feedback.
5. Comparison content and Google Maps/directions destinations were correct.
6. Picker selection, opening, picking again, dismissal, and skipped-place exclusion/inclusion worked in the first-pass walkthrough.
7. Completing/reopening preserved membership and saved-place status/favorite state.
8. Closing/reopening retained the plan and members.
9. Title editing, keyboard-first Android Back, draft protection, and larger-text button usability passed the requested walkthrough.

The owner identified unspecified general UI concerns and explicitly deferred addressing them to an update beyond 0.6, after the main features are implemented. Do not expand 0.6 into a general UI redesign. No individual UI defects have been described or inferred.

Still pending device-specific coverage: offline mutation recovery; member/plan/saved-place deletion isolation; explicit empty, one-place and all-skipped edge cases; schema-4 export; account switching; no-Place-ID fallback; 20-item capacity using safe existing fixtures; full appearance/reduced-motion/TalkBack checks; and remaining library/inbox regression scenarios. Database concurrency, grants, account deletion and isolation retain their automated evidence. Do not interpret the nine passes as acceptance of unperformed scenarios or completion of the full release.

Earlier statements that no build was started or device evidence existed describe the earlier checkpoint and are superseded by this owner report. No new build, OTA update, commit, push, or publication was performed while recording these results.

## Owner device acceptance — second pass

The owner reported that the requested checks 10–15 passed:

10. Offline title-save failure preserved the draft; reconnecting and retrying recovered.
11. Removing a membership preserved the saved place in the library.
12. Deleting a temporary plan preserved its saved places.
13. Empty, one-place, and all-skipped picker behavior, including explicit skipped-place inclusion, worked.
14. Export reported schemaVersion 4 and diningPlans with titles and ordered placeIds.
15. Account switching hid the other account's plans and restored the original account's plans on return.

This is owner-reported device evidence for the supplied walkthrough, not agent-observed evidence. Combined owner walkthrough checks 1–15 are now reported passed. General UI improvements remain deliberately deferred beyond 0.6.

Remaining separately unverified device scenarios: deleting a disposable saved place that belongs to multiple plans and checking cascade cleanup; reaching the 20-member limit with existing safe fixtures; Maps fallback for a record without a Place ID; explicit light/dark/system appearance, reduced motion and TalkBack checks; and the remaining library/inbox/import/source regression walkthrough. Native account-deletion testing remains unperformed; local database/API deletion and isolation tests passed. Do not label these outstanding scenarios as device passes or the entire release as accepted yet.

## Owner device acceptance — final pass

The owner reported checks 16, 17, 19, and 20 passed and explicitly skipped check 18 because they did not consider it important for this release:

16. Deleting a disposable saved place shared by two plans cleaned up memberships while preserving the plans and other members.
17. The 20-member capacity and blocked extra addition worked.
18. No-Place-ID Maps fallback: SKIPPED by owner; no device pass claimed. URL fallback construction retains automated unit-test coverage.
19. Light/dark/system appearance, reduced motion, and basic TalkBack navigation on Plans and Inbox passed the requested walkthrough.
20. Library search/filter/sort, inbox capture, and existing Instagram source opening passed.

Owner walkthrough outcome: 19 passed, one explicitly skipped (18). This completes the agreed owner walkthrough with that recorded exception. General UI concerns remain deferred beyond 0.6 at the owner's request. The results are owner-reported, not independently agent-observed. Native account-deletion behavior was not included in the completed device walkthrough and retains automated database/API evidence only. No skipped or unperformed check is represented as a pass.

The 0.6.0 preview is installed and owner-tested. No further implementation was requested by this report. Git commit/push, tagging, GitHub release, public website publication, or another build/update remain unauthorized. The next optional work package is release/prerelease preparation when requested.

## Authorized GitHub prerelease preparation — 2026-09-14

The owner authorized creating a feature branch, pushing it, merging to master, and establishing prerelease 0.6 in the prior release format. Branch: `feature/outing-plans-map-handoff`. Notes: `docs/prerelease-v0.6.0.md`. Tag: `v0.6.0`.

EAS independently confirms build `22d1d226-8743-4a0b-9ab2-59c30c5e9a18` is FINISHED, app/runtime 0.6.0, Android versionCode 23, preview channel and internal distribution. The exact completed APK and SHA256SUMS.txt are prepared as GitHub release assets under ignored `dist/prerelease-v0.6.0/`. Application code has not changed during release preparation; the current changes finalize documentation. No new build, OTA update, or website deployment is part of this publication.
