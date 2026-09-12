# Release 0.5 — Import inbox and resilient capture

Status: **0.5.0 preview / Android build 22 installed and owner-tested**. Authorized hosted migrations are applied. All 108 automated tests, TypeScript, Expo Doctor, Android bundle, native PostgreSQL concurrency/cleanup recovery and local PostgREST/client checks passed. The owner reports that the final-APK upgrade/session, capture, processing and seven-item regression checklist passed. The agreed final-build walkthrough is complete; larger-text and keyboard checks remain explicitly deferred, and automated-only failure/capacity coverage is distinguished below. This is not a claim that every original manual scenario or store qualification is complete.

## Implemented behavior

- Home retains the saved library as its primary screen and adds a restrained inbox count entry.
- Protected `/inbox` supports multi-link paste, newest-first rows, refresh, per-item processing/deletion, needs-attention copy, and confirmed clear-all.
- Capture canonicalizes URLs, deduplicates within a paste, accepts 20 unique supported links, and reports added/already queued/already saved/invalid/capacity-limited counts, repeated URLs, and omitted links above the batch limit. No success message appears when zero items are added.
- Capturing makes no Apify, Instagram, or Google request. Rows use only stored URL-derived type, origin, capture date, optional hint, and bounded failure state.
- Incoming shares are retained in session before the native intent is reset, then enqueued. Failed/capacity-limited shares remain retryable or explicitly dismissible. Already-saved shares offer the existing place detail.
- A share never calls `beginSharedAdd`, resets the navigation stack, or overwrites the active draft. An active import remains mounted while the user views the inbox; other Process controls are disabled and Resume current import is offered.
- Process opens the existing add screen with inbox identity, canonical URL, and hint. It does not import. Find Place records one attempt and checks saved-source identity before providers. A prior successful save with failed cleanup therefore needs no additional provider requests.
- Hints save on blur, through Save hint, and before Find Place. Hint writes are bounded to 200 characters. Leaving before saving a hint does not guarantee that unsaved text survives termination; the inbox URL itself remains durable.
- Categorized import/search failures mark needs_attention without storing raw errors. A failed or interrupted attempt leaves the item pending and available. Direct Add Place remains available.
- All three existing save outcomes (`created_place`, `attached_source`, `existing_source`) resolve the inbox item, return to inbox, show the remaining count, and offer Open place. Cleanup failure is reported separately from successful place persistence.

## Schema, ownership, and concurrency

CLI-created migration: `supabase/migrations/20260910162113_add_import_inbox.sql` (Supabase CLI 2.117.0).

The additive `import_inbox_items` table has UUID identity, Clerk subject ownership, canonical source URL (maximum 2048 characters), share/manual origin, pending/needs_attention status, optional 200-character hint, allowlisted failure category, attempt count bounded to 0–100000, attempt timestamp, and created/updated timestamps. There is no durable processing state or completed-import history.

A unique `(user_id, source_url)` constraint enforces identity. The one query index is `(user_id, created_at DESC, id DESC)`. Independent inbox records have no saved-place foreign key.

RLS has separate SELECT/INSERT/UPDATE/DELETE policies using the verified `auth.jwt()->>'sub'`, with both USING and WITH CHECK for UPDATE. Explicit grants allow authenticated select/insert/delete and only the required update columns. Owner, URL, ID, origin, and capture date cannot be changed through authenticated update. Anonymous/PUBLIC access is revoked; new RPC execution is authenticated-only, SECURITY INVOKER, with an empty search path.

`enqueue_import_inbox(text[], text)` performs one bounded capture operation. A per-owner transaction advisory lock serializes duplicate/capacity decisions. A before-insert trigger also takes that lock and enforces saved-source exclusion and the 100-item capacity, preventing direct Data API inserts from bypassing the limit. `begin_inbox_attempt(uuid, text)` updates hint, count, timestamp, and status atomically. The existing account-data deletion function deletes inbox rows in the same authenticated transaction while preserving its 0.4 return signature.

## State, privacy, and cost

The inbox repository maps rows to domain objects; UI components do not consume raw database rows. A separate inbox provider owns hydration/mutations and uses a dedicated Clerk-bound Supabase client. The authenticated provider tree is keyed by user ID, and late reads after unmount cannot hydrate another account. The inbox refreshes on focus and explicit refresh; there is no Realtime subscription.

Export schema is 3. Pending inbox records are explicitly projected into `data.importInboxItems`, separate from saved places and their sources. Export reads the authenticated user's persisted inbox. Account deletion and sign-out clear local state. The public deletion page and account export copy include inbox data.

PostHog uses empty transition events plus one bounded aggregate event per capture action. No URLs, shortcodes, hints, database IDs, captions, or other submitted content are event properties. New Sentry calls receive fixed messages and the inbox_storage/storage operation/category only. Raw database errors are replaced at the repository boundary.

No application dependencies, environment variables, provider integrations, native plugins, permissions, Edge Functions, paid services, workers, queues, storage buckets, or background processing were added. Capture consumes bounded existing database operations, with no provider cost. Testing installed PGlite 0.3.14 and pg 8.16.3 only under the OS temporary directory; neither is in the app manifest/lockfile. Their optional paths are documented in the verification scripts.

## Earlier validation checkpoint (superseded by dated updates below)

| Check | Result |
| --- | --- |
| Starting regression baseline | 93/93 tests; TypeScript passed |
| Final automated suite | 107/107 passed, including executable component/state/repository tests |
| TypeScript | `npm run typecheck` passed |
| Expo Doctor | 18/18 checks passed |
| Android production JS export | Passed on final 0.5.0 code, 1745 modules, 6.85 MB Hermes bundle |
| Entire SQL migration chain | All 12 migrations executed successfully in isolated PGlite PostgreSQL |
| SQL behavioral/security assertions | Passed: canonical enqueue, duplicates, mixed invalid batch, limits, hint/attempt bounds, attention transitions, cross-user select/insert/update/delete, immutable owner, grants, anonymous revocation, three 0.4 save outcomes, dismissal independence, and account deletion isolation |
| Hosted security advisor | No findings on the existing hosted schema |
| Hosted performance advisor | Two pre-existing INFO unused-index notices: saved_places_created_at_idx and saved_places_status_idx |
| Local Supabase migration list / pgTAP / advisors | Blocked: no Docker/Podman; connection refused at 127.0.0.1:54322 |
| Separate-connection concurrency test | Script prepared and attempted; blocked by the same missing local database |
| Android device/native build | Not performed: ADB/SDK not available on PATH or the standard user SDK path; no native project regenerated |
| Final diff review / `git diff --check` | Passed; no unrelated changes identified |
| Lint | No lint script configured |

The hosted advisors do **not** validate the unapplied 0.5 migration. PGlite supplies real SQL/RLS execution with a minimal `auth.jwt()` fixture but has a single connection; it does **not** verify PostgREST, Clerk JWT verification, or competing PostgreSQL transactions. The optional concurrency script requires a localhost database and tests duplicate enqueue plus competing inserts for the final capacity slot. It refuses remote database URLs and cleans up its uniquely scoped fixture subject.

Advisor reference: [Supabase unused-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). Existing indexes were left intact.

### Reproduce automated checks

```powershell
npm test
npm run typecheck
npx expo-doctor
npx expo export --platform android --output-dir dist/release-0.5-check
node script/verify-inbox-pglite.cjs
git diff --check
```

The PGlite script expects the temporary dependency location described in its header, or an explicit `PGLITE_MODULE` path. It executes the same SQL ASSERT statements as the pgTAP fixture, omitting only the pgTAP plan/pass/finish wrapper.

### Next safest local database checks

Install/start Docker Desktop or Podman first. Use a disposable local Supabase stack; no hosted credentials are needed:

```powershell
npx supabase start
npx supabase migration up --local
npx supabase migration list --local
npx supabase test db --local
npx supabase db advisors --local --type all
node script/verify-inbox-concurrency.cjs
```

The concurrency script defaults to local port 54322, or accepts `INBOX_TEST_DATABASE_URL` for another localhost instance and `PG_MODULE` for the temporary pg package. After those checks, exercise the client against local PostgREST with two test Clerk subjects. Do not substitute a production project.

## Original Android acceptance checklist (results recorded below)

No Release 0.5 Android acceptance scenario was observed by the agent or reported by the owner in this task. The earlier owner-reported 0.4 smoke tests remain in the 0.4 release notes and are not counted as 0.5 verification.

All 22 release scenarios remain pending on a development client or compatible local build:

1. Cold-start share of a new reel.
2. Inbox capture without provider processing.
3. Repeat share without a duplicate.
4. Share an already-saved source.
5. Open that existing place without an inbox insertion.
6. Paste mixed valid/invalid links.
7. Verify summary, canonical deduplication, and batch limit.
8. Start processing and navigate back.
9. Confirm the inbox item remains.
10. Restart and confirm persistence.
11. Save a hint and confirm it survives restart.
12. Controlled/mock failure and needs-attention state.
13. User-triggered retry and completion.
14. Verify inbox removal and saved source.
15. Exercise all three save outcomes.
16. Share another URL during an import.
17. Confirm the active draft is preserved and resume works.
18. Delete one item and cancel/confirm clear-all.
19. Capacity fixtures without provider requests.
20. Export schema 3 with pending items.
21. Light/dark/system appearance, large text, keyboard, reduced motion, and Android Back.
22. Release 0.4 library search/organization regression.

Also test place-save success followed by forced cleanup failure, airplane-mode capture retry, account switching with outstanding requests, and fresh-session export/deletion.

Signed-out shares continue to rely on the existing root ShareIntentProvider and authenticated handoff. No anonymous records are created. Native library/OS retention before authentication is best effort; a process termination before authenticated capture can lose an unpersisted share. Retryable failed captures are likewise session-only until storage succeeds.

## Original rollout plan (hosted deployment subsequently authorized below)

1. Finish local Supabase multi-connection/PostgREST checks and Android acceptance; fix any failures.
2. Obtain separate authorization to apply the additive migration to the hosted project.
3. Apply the migration before distributing the new client. Existing 0.4 saves and deletion responses remain compatible. A delayed client rollout does not require dropping the table.
4. Build a compatible **0.5.0 native binary** after approval, preferably locally. `runtimeVersion.policy` remains `appVersion`, so 0.5.0 updates cannot target the 0.4.0 binary.
5. Only later publish authorized runtime-compatible 0.5 OTA updates with a rollback path.

Application/package/lockfile versions are 0.5.0. No native dependency or plugin changed; the app-version runtime transition itself requires a compatible binary. Generated Android code is ignored by Git and was not regenerated.

No remote migration, Edge Function deployment, EAS build/update, commit, push, merge, tag, release, production mutation, public-site publish, or paid service activation was performed. Recommended next work package: local Supabase + Android acceptance, followed by separately authorized migration and native distribution.

Final resumed checkpoint: 107/107 tests, TypeScript, isolated PostgreSQL assertions, and the 0.5.0 Android export passed. Validation logs are under ignored `dist/release-0.5-tests.txt` and `dist/release-0.5-export.txt`. No required native or multi-connection check is represented as complete.

## Approved hosted deployment — 2026-09-11

The owner explicitly authorized the hosted inbox migration for device testing. Supabase applied `add_import_inbox` as remote version `20260911065626`. Post-deployment inspection confirmed RLS enabled, four ownership policies, authenticated access, no anonymous select/enqueue, and no authenticated owner updates.

The performance advisor flagged the JWT lookup form. A CLI-created follow-up, `20260911065712_optimize_inbox_rls_jwt_lookup.sql`, was validated against the complete 13-migration chain and applied through Supabase as `optimize_inbox_rls_jwt_lookup`. The follow-up uses the same `(select auth.jwt())->>'sub'` form as the established project policies. Security advisors now report no findings; performance advisors report only INFO unused-index notices (the two prior indexes and the new, not-yet-used inbox index). Earlier statements that no remote migration was performed describe the pre-approval checkpoint only.

Android connection was verified: Samsung SM-A556E, Android 14. Installed apps: production 0.4.0/build 21 and development 0.3.0/build 4. Official platform-tools were downloaded to the OS temporary folder; the owner approved USB debugging. A mock-provider Metro session was started on localhost:8081 without modifying environment files. The phone subsequently disconnected before the local development session could launch. No device acceptance scenario has yet passed. A current 0.5 native binary is still required for distribution; the existing development client is only an interim JavaScript test host.

## Owner-observed Android capture and refresh correction

The owner reported seeing the inbox entry, sharing an Instagram reel into the inbox instead of the add-place flow, the Added to inbox notice, Continue dismissing that notice, View inbox opening the same screen as the home entry, and the shared reel waiting for processing. This is owner-reported evidence, not an agent-observed complete acceptance run. Batch capture, duplicates, processing, restart, and other scenarios remain unverified on device.

The owner also noticed occasional unsolicited refreshing. Inspection found that the installed Clerk Expo useAuth creates a fresh getToken wrapper on each auth render. The inbox repository depended on that wrapper, recreating refresh callbacks and retriggering hydration/focus effects. InboxProvider now keeps its repository stable per user while a ref supplies the latest token getter. A regression test verifies one client/read across changed getters, stable refresh identity, and use of the newest token. All 108 tests and TypeScript passed. Device confirmation of the refresh fix is pending.

## Additional owner-reported Android acceptance

The owner confirmed the following on the connected development-client session:
- Inbox remained steady after the token-callback refresh fix.
- Sharing the same reel returned Already in inbox without a duplicate.
- Saving a hint, returning with Android Back, and reopening retained the hint.
- Find Place with mock providers, candidate selection, Save Place, inbox removal, and return navigation passed. The owner removed the resulting test place.
- Sharing a different reel during an active import preserved the current URL and hint and queued the new reel.
- Closing/reopening the development app preserved a queued item and saved hint.
- Newline-separated batch capture reported exactly 2 added, 1 repeated, and 1 invalid.
- Delete-one, cancel clear-all, and confirm clear-all passed; the saved-place library remained unchanged.

These are owner-reported results, not independently observed UI automation. Export schema 3 on-device, already-saved-source capture, attached_source/existing_source completion, controlled failures/cleanup failure, capacity, account isolation, and the remaining appearance/accessibility checks still require acceptance evidence. Full local Supabase multi-connection verification and a distributable 0.5 binary remain pending.

## Further owner-reported acceptance and deferral

The owner confirmed:
- Export schema 3 includes the queued item and saved hint separately from saved places.
- Sharing an already-saved source offers the existing place without creating an inbox row.
- Offline capture retains a retryable link; restoring connectivity and retrying queues it once without starting a search.
- Light and dark appearance checks passed.
- Existing library search, filtering, and sorting behave as before the inbox update.

The owner explicitly deferred larger-text and keyboard/Android Back keyboard-order checks until later UI work. These checks are untested, not passed. Previously confirmed Back behavior from an import and restart persistence remain separate results. Technical failure-path coverage, concurrent-database validation, and final native-binary qualification remain outstanding where not already covered by automated tests.


## Native PostgreSQL concurrency and failure recovery — 2026-09-11

All 13 migrations and the complete SQL behavioral/assertion fixture passed on disposable native PostgreSQL 17.10. Temporary `@embedded-postgres/windows-x64@17.10.0-beta.17` binaries and `pg@8.16.3` ran on localhost:55432. The server was stopped after verification; no hosted data or application dependencies changed.

`script/verify-inbox-concurrency.cjs` now holds the first transaction open and verifies through `pg_blocking_pids` that a second authenticated connection is blocked before committing. Duplicate capture returned queued then already_queued. With 99 items, competing captures returned queued then capacity_reached, leaving exactly 100.

The same script committed a saved place and source, held a row lock on its inbox item, and forced cleanup to fail with PostgreSQL statement timeout (57014). The place, source, and pending item all remained. Retrying the save returned existing_source; subsequent cleanup removed only the inbox item, leaving exactly one place and one source. UI completion coverage also checks cleanup returning false or throwing for all three save outcomes, preserving successful-save messaging and the Open place action.

These checks replace the earlier concurrency tooling blocker. They verify SQL transactions and application failure handling, not full PostgREST or Clerk token verification. The database fixture uses synthetic JWT claims under the authenticated role. Remaining device/native qualification and the owner-deferred UI checks are unchanged.


## Final API verification and build preflight — 2026-09-12

The actual InboxRepository and Supabase JavaScript client passed against native PostgREST 16.3 and PostgreSQL 17.10 using disposable signed fixture identities. Anonymous, expired and invalid-signature tokens receive HTTP 401. Canonical enqueue/deduplication, listing, hint writes, attempt increments, attention state, retry and deletion pass over HTTP. A second identity cannot select/update/delete the first owner’s rows or forge an insert for that owner. Owner reassignment is denied. Both identities can independently queue the same URL, and deleting one owner’s row preserves the other.

`script/verify-inbox-api.ts` accepts localhost only; `script/verify-inbox-native.cjs` creates a disposable Windows PostgreSQL database, applies all migrations, runs SQL/concurrency checks, launches PostgREST with a random test-only signing secret and stops both servers afterward. Optional binaries/packages stay outside app dependencies: pg 8.16.3, @embedded-postgres/windows-x64 17.10.0-beta.17 and the official PostgREST 16.3 Windows binary in TEMP/lemonade-inbox-validation/postgrest. No hosted data is mutated by these fixtures. This validates JWT signature enforcement and RLS over HTTP, not Clerk issuance itself; existing owner walkthrough covers ordinary hosted access, while final-APK sign-in/session acceptance remains pending.

Preflight: 108/108 app tests passed, TypeScript passed, Expo Doctor 18/18 passed. Hosted security advisors report no findings; performance has only the two pre-existing unused-index INFO notices. Hosted inbox migrations confirmed at 20260911065626 and 20260911065749.

The owner authorized one EAS build, intended as the final 0.5 candidate, after local compilation proved impractical with roughly 2–3 GB free disk space. The portable Android/JDK tools downloaded during this attempt were removed to recover space. Use the existing preview profile/internal distribution, preview channel and established credentials. Preview environment has the existing Clerk test instance, correct Supabase project and real apify/google providers. No provider requests are made by bundle/build validation. The existing 0.4 preview APK is build 21. Exact 0.5 APK acceptance and explicitly deferred UI checks are not represented as complete.


## Single authorized EAS build — 2026-09-12

EAS accepted preview/internal Android build `5ac00be3-2f73-4ad3-939b-7c5d092f1136`, app 0.5.0 / versionCode 22, using the existing remote keystore. The uploaded archive was inspected beforehand: current uncommitted 0.5 sources are included; local environment files and stale generated Android files are excluded. Git metadata still names the last 0.4 commit because the owner has not requested a commit; the build uses the uploaded working tree. Archive size is 581 KB. EAS completion was subsequently confirmed during prerelease preparation; owner installation and acceptance are recorded below. No additional EAS build is authorized if this one fails.


## Final build 22 owner acceptance

The owner reported that the single authorized EAS build completed and was installed, then confirmed the following on the installed 0.5.0 preview APK (versionCode 22). Monitoring had been stopped at the owner's request; completion and installation are owner-reported, not independently inspected afterward.

- Upgrade preserved saved places, inbox items and saved hints. Closing/reopening preserved the authenticated session and loaded the same data without Metro or USB.
- Cold-start sharing queued a new reel without starting provider processing; repeating the share produced Already in inbox with one row.
- Explicit live Find Place, candidate confirmation and save returned to the inbox, removed the item and opened the saved place with the correct Instagram source.
- Final checklist 1: sharing an already-saved source offered the existing place without another inbox row.
- Final checklist 2: processing a second reel for the same venue attached its source to the existing place; one place retained both links and the inbox item resolved.
- Final checklist 3: sharing another reel during an active import preserved the original URL and hint while queuing the new reel.
- Final checklist 4: offline capture followed by restored connectivity and explicit Retry queued exactly one item without automatic search.
- Final checklist 5: newline-separated mixed paste reported 2 added, 1 repeated and 1 invalid; deleting a test inbox item preserved saved places.
- Final checklist 6: export schema 3 included the queued item and saved hint.
- Final checklist 7: library search/filter/sort and light/dark appearance passed.

The owner reported all seven checklist items passed. No application code changed after the build upload; subsequent changes record verification results only. No second build, OTA update, commit, push or store submission was performed.

Remaining scope: larger-text and keyboard/Android Back keyboard-order checks remain explicitly deferred to UI work. Forced cleanup failures, concurrent inserts, capacity enforcement, cross-account isolation and all three save-result completion branches have automated coverage; this does not claim every corresponding original manual scenario was performed on build 22. Final-build fresh-login/account-switch flows, controlled needs-attention failure, capacity-message fixtures, system-theme/reduced-motion behavior and full clear-all were not separately repeated in this final checklist. Earlier development-client results remain separate. The agreed final-build walkthrough is complete; deferred or automated-only checks are not marked as manual passes.


## Final prerelease preparation

Final diff review found no release-blocking issue in the scoped inbox implementation. Application dependencies are unchanged apart from version metadata. A byte-for-byte comparison of 116 application, configuration, patch and migration files against the inspected EAS upload found no differences. The tested build therefore still matches the release application sources. `git diff --check` passed. Existing automated validation remains applicable; no application changes were made during this review.

EAS now independently reports FINISHED for build 5ac00be3-2f73-4ad3-939b-7c5d092f1136, app 0.5.0 / build 22 / runtime 0.5.0. Prerelease notes are prepared in `docs/prerelease-v0.5.0.md`. The exact APK and SHA256SUMS.txt are prepared under ignored `dist/prerelease-v0.5.0/` as future release assets, not Git source files. The notes explicitly distinguish owner-observed tests, automated coverage and deferred UI checks. No commit, push, tag or GitHub release has been created.

Release asset: 111,003,490 bytes. SHA-256: `92e145c860d3cf7042d1a89fb3d3da6ec1201b8c41794e278d3209a5c584f6ed`. APK archive contains AndroidManifest.xml, classes.dex and the embedded JavaScript bundle.
