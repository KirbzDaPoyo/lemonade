# v0.5.0 — Import Inbox and Resilient Capture

Android preview prerelease: **0.5.0, build 22**, runtime **0.5.0**.

Share Instagram posts and reels into a private inbox and process them when you choose. Sharing no longer immediately starts an import or replaces an active draft.

## What changed

- Capture up to 20 unique links per paste, with a 100-item inbox per account. Newlines or whitespace separate links; capture reports duplicates, invalid URLs and capacity limits.
- Keep pending links and saved place-name hints across app restarts. Process one item at a time through Find Place and candidate confirmation.
- Preserve an active import when another reel is shared. Retry failed captures explicitly; capture itself makes no Instagram or Google request.
- Resolve inbox items after creating a place, attaching another source or identifying an existing source. A cleanup failure does not undo a successful save.
- Delete inbox items independently of saved places. Export schema 3 and account-data deletion now include inbox data.

## Android installation

Install `project-lemonade-0.5.0-android-build22.apk` from the release assets. It uses the existing preview app identity/signing credentials and upgrades the 0.4 preview app. Metro and USB are not required. This preview uses the existing Clerk test instance and live import/search providers; Find Place can make provider requests.

[EAS build record](https://expo.dev/accounts/land-of-poyo/projects/project-lemonade/builds/5ac00be3-2f73-4ad3-939b-7c5d092f1136). The matching `SHA256SUMS.txt` release asset records the APK checksum.

## Backend compatibility

The following additive migrations are required before using this client and are already applied to the existing hosted project:

| Migration | Repository version | Hosted version |
| --- | --- | --- |
| `add_import_inbox` | `20260910162113` | `20260911065626` |
| `optimize_inbox_rls_jwt_lookup` | `20260911065712` | `20260911065749` |

The 0.4 client remains compatible. Existing deployments must reconcile migration history before using an automated migration push; do not apply these migrations twice. The 0.5 runtime requires this native binary and cannot be delivered as an OTA update to a 0.4 binary. No runtime dependencies were added.

## Verification and known limits

- 108 automated tests, TypeScript, Expo Doctor (18/18) and Android bundle validation passed.
- PostgreSQL migration, ownership, concurrent deduplication, capacity and cleanup-recovery checks passed. Real PostgREST/Supabase-client tests rejected invalid/expired tokens and verified isolation between signed fixture identities.
- The owner tested build 22: upgrade/session persistence, cold-start sharing, duplicates, live save and source attachment, draft preservation, offline retry, mixed paste, deletion, export and library/appearance regressions passed.
- Larger-text and keyboard checks are deferred to later UI work. Forced failures, capacity and cross-account edge cases have automated coverage; not every corresponding manual scenario was repeated on build 22. Full iOS qualification is outside this Android prerelease.
- Shares not yet stored successfully are retained only for the current session. Closing the process before capture succeeds can lose such a link; private Instagram imports and background processing are not supported.

Detailed evidence and omitted checks are recorded in `docs/release-0.5-import-inbox.md`.
