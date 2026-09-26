# v0.8.0 — Visit History and Personal Reflections

Android preview: **0.8.0, build 26**, runtime **0.8.0**.

Record private visits to saved places, with a required local calendar date, optional personal rating from 1–5, and an optional reflection of up to 2,000 Unicode characters.

## Included

- Multiple visits per place, with create, edit, confirmed deletion, and safe retries.
- Bounded history pages with total visits, latest visit date, and the latest rated visit's personal rating.
- Logging a visit atomically marks the place Visited. Editing/deleting history leaves status unchanged; manual status changes preserve history. Existing Visited places receive no invented entries.
- Recently visited, Most visited, and Personal rating sorts in the ordinary library. Map loading, filters, and distance behavior remain unchanged.
- A plan-place shortcut into the visit form. Completing a plan does not create visits.
- Complete schema-5 exports, account-scoped state, database ownership checks, and deletion cascades. Journal activity makes no additional Google or Instagram requests.

## Install

Install `project-lemonade-0.8.0-android-build26.apk` from the GitHub release assets over the existing preview. The package and signing identity are unchanged. Use `SHA256SUMS.txt` to verify the download. APK SHA-256: `fd05e7ff0b19146882bd21f66d89f431450468b19b519cb5a7371be4b6f18319`.

[EAS build 26](https://expo.dev/accounts/land-of-poyo/projects/project-lemonade/builds/0955981d-b929-4560-945b-2a8fc514eff1).

This binary was built from the uploaded uncommitted 0.8 working tree. EAS records the earlier Git HEAD (`d5cf972e2dee3f73a1bb5a6b4f85b6d264bb465b`); this release commits that implementation with its documentation. Runtime policy remains `appVersion`: use this binary for 0.8, not an OTA update to the installed 0.7 runtime.

## Backend rollout

The following migrations are already applied to hosted project `mrlumqsdabxptkwmqjwf`:

| Migration | Local version | Hosted version |
| --- | --- | --- |
| add_place_visits | 20260925094733 | 20260926033821 |
| add_visit_history_page | 20260925100637 | 20260926033846 |
| add_library_visit_summaries | 20260925163101 | 20260926033912 |

Do not reapply them. Earlier local/hosted migration versions also differ; reconcile migration history before any automated database push. No new environment variables, dependencies, paid services, or provider calls were introduced.

Hosted checks confirmed RLS, four ownership policies, blocked anonymous access, immutable ownership, invoker functions with empty search paths, and the composite saved-place ownership foreign key with deletion cascade. The initial visit table was empty. Advisors reported informational notices only: intentional private quota tables without client policies, unused indexes, and a foreign-key index-order notice. An actual query plan confirmed the existing history index covers both ownership columns; no duplicate index was added.

Rollback retains the additive journal schema and data. An older client may continue using existing features, but its schema-4 export omits visits and is not a complete journal backup. Do not drop visit records as part of rollback.

## Validation

- 171 automated tests passed; TypeScript, whitespace checks, and Expo Doctor 18/18 passed.
- Android production compilation and web export passed. Clearing generated Metro cache resolved an interrupted web bundle's cache error.
- The complete 20-migration chain and native PostgreSQL ownership, validation, concurrency, lifecycle rollback, and deletion checks passed.
- Real Supabase client/PostgREST checks verified deterministic history pagination, 406 place summaries across batches, and all 1,051 synthetic export entries, including account isolation. Large read-test fixtures bypassed triggers only during setup; separate actual API writes and database tests exercised production triggers.
- Hosted migration and permission checks passed. The owner installed build 26 and reported success for the walkthrough below.

## Android acceptance reported by the owner

Passed: first date-only visit; repeat same-day rated/reflection visit; persistence after reopening; editing date/rating/reflection; clearing optional values; canceling deletion; deleting the last visit without reversing status; manual status/history independence; future-date rejection with retained draft; offline save and exactly-once retry; all three sorts with existing filters/search; plan shortcut and completion independence; schema-5 export; account switching and isolation; Light/Dark/System themes; increased font size; Android keyboard/Back and discard behavior; saved-place deletion removing its visits from export.

Explicitly skipped: account deletion on the 0.8 device build (the visit cascade has automated database coverage), and TalkBack/reduced-motion device testing. Physical iOS remains unverified. Public privacy pages remain undeployed drafts. These limitations do not represent device passes.

Export is a paginated multi-resource read, not a single cross-device database snapshot. Finish editing before exporting a backup. See [export schema](data-export-schema.md) for fields, cleanup behavior, and limitations. A durable offline queue and public reviews are outside this release.
