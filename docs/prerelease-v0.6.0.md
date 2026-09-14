# v0.6.0 — Outing Plans and Map Handoff

Android preview prerelease: **0.6.0, build 23**, runtime **0.6.0**.

Turn your private saved-place collection into shortlists for your next meal. Create outing plans, compare places, make a lightweight random choice, and open Google Maps or directions using existing saved data.

## What changed

- Create, rename, complete, reopen, and delete private outing plans. Active and completed plans are separated.
- Add up to 20 places from place detail or a searchable library picker. Duplicate and capacity limits are enforced in the database under concurrency.
- Compare stored area, category, specialty, lifecycle, favorite, tags, and note presence. Plan changes do not alter saved-place status, favorites, or other metadata.
- Pick for me excludes skipped places by default, handles empty/one-place/all-skipped shortlists, and keeps results temporary.
- Open Maps and directions through encoded universal URLs using stored Place IDs or validated fallbacks. No map SDK, location permission, or additional provider requests.
- Export schema 4 includes plans and ordered memberships; authenticated account-data deletion includes plans.
- Preserve title drafts after failed saves, improve keyboard/Back handling, and allow V2 button labels to wrap at larger text sizes.

## Android installation

Install `project-lemonade-0.6.0-android-build23.apk` from the release assets. It uses the existing preview identity and signing credentials and upgrades the 0.5 preview. Metro and USB are not required. This preview uses the existing Clerk test instance and live import/search providers; Find Place can still make provider requests.

[EAS build record](https://expo.dev/accounts/land-of-poyo/projects/project-lemonade/builds/22d1d226-8743-4a0b-9ab2-59c30c5e9a18). `SHA256SUMS.txt` records the matching APK checksum. EAS recorded the earlier Git HEAD because the build uploaded the uncommitted 0.6 working tree; the prerelease commit records that implementation and subsequent verification documentation.

## Backend compatibility

These additive migrations are already applied to the existing hosted project:

| Migration | Repository version | Hosted version |
| --- | --- | --- |
| `add_dining_plans` | `20260912132149` | `20260912140840` |
| `index_dining_plan_membership_owner` | `20260912140936` | `20260912140955` |

Reconcile migration history before automated migration push; do not apply these twice. The 0.5 client remains compatible, but its schema-3 export does not include plans. Runtime 0.6.0 requires this native binary and cannot be delivered as an OTA update to a 0.5 binary. No runtime dependencies or environment variables were added.

## Verification and known limits

- 128 automated tests, TypeScript, Expo Doctor (18/18), and Android production JavaScript export passed.
- All 15 local migrations and database/concurrency/HTTP repository tests passed, including ownership, duplicate/capacity races, deletion cascades, and account isolation.
- Hosted security advisors are clean; performance advisors contain only unused-index INFO notices.
- Owner walkthrough: 19 checks passed. No-Place-ID Maps fallback was explicitly skipped on device and retains automated URL-test coverage only.
- General UI improvements are deliberately deferred beyond 0.6. Native account deletion retains automated database/API evidence rather than a device pass. Full iOS qualification remains outside this Android prerelease.

Detailed evidence and the full owner walkthrough are recorded in `docs/release-0.6-outing-plans.md`.
