# v0.9.0 — Read-only plan sharing

Android preview: **0.9.0, build 28**, runtime **0.9.0**. Sharing is enabled for this prerelease (activated 30 September 2026).

## Included

- Owner-reviewed public titles, independently authored place names and optional locations, with up to 20 places.
- Enable, copy, native share sheet, replace and disable controls. Reopening controls recovers the same encrypted link.
- Read-only browser access without an account at share.makeitlemonade.app, safe map links, and refreshed content after updates. Old links stop retrieving after replacement or disable.
- Android App Links open the public plan with the app running, closed or signed out. Recipients cannot edit the owner's plan.
- Sharing feedback remains visible below the scrolling editor. Saved-name progress explains the manual public-label requirement.
- Schema-6 exports include safe sharing metadata; bearer links and encrypted credentials are excluded.

## Installation and source

[EAS build 28](https://expo.dev/accounts/land-of-poyo/projects/project-lemonade/builds/d0905ea3-24cf-4fe8-aad9-55b22725af88). Install the preview APK over the existing app. Existing signing identity and package com.projectlemonade.mvp are retained. Native clipboard support requires this binary; do not send this as an OTA update to 0.8.

The owner installed and tested build 28. EAS uploaded the uncommitted mobile working tree; its Git HEAD refers to the earlier website/domain commit, not all included mobile code. Subsequent policy/release documentation edits do not require another native build. The GitHub prerelease includes the tested APK and SHA256SUMS.txt; no app-store submission has been made.

## Backend rollout

The new migrations are already applied. Do not replay them or run a whole-directory database push against the mismatched historical migration IDs.

| Migration | Local version | Hosted version |
| --- | --- | --- |
| add_plan_sharing | 20260926162945 | 20260928141614 |
| sharing_owner_metadata | 20260927065245 | 20260928141628 |

Owner/recipient Edge Functions and server-only encryption settings are deployed. The website connects to the fixed public endpoint. Android association uses the verified preview signing certificate; Play app signing and iOS require separate verified identities. Optional browser Open in Lemonade button remains hidden; verified Android links work independently of that button.

## Validation

204 automated tests pass. Focused checks and TypeScript passed before build 28. Prior full local database/API checks covered ownership, grants, quotas, races, encrypted recovery, revocation and deletion. Hosted synthetic tests verified projection, replacement and disable. Source-only metadata/logging checks have the limitations recorded in release-0.9-sharing-privacy.md.

Owner-reported device passes: existing private data; 20-place editor; preview; saved drafts and Back/discard; enable/copy/share; same-link recovery; replacement/disable; private-browser access; public updates after refresh; revoked content clearing; Android warm/cold and signed-out opening; improved feedback placement; schema-6 export; test-plan deletion reflected in exports while saved places remain; large text; light/dark themes; keyboard/Back.

Explicitly untested: TalkBack (owner skipped), physical iOS, account deletion on this device release, and absent-app/older-app native-opening fallback on a separate device. Account-deletion cascades have automated coverage; do not treat that as a physical-device pass. No zero-retention or zero-provider-access guarantee is made. Owner reports no other organization members and no known external log forwarding.

## Operations and rollback

SHARING_ENABLED=true is configured and verified. Set it to false to stop public retrieval and credential delivery/creation without deleting private plans or public labels. Existing copies/screenshots cannot be recalled. Preserve encryption keys while associated links exist. A restored backup must not resurrect old credentials without an invalidation review. See release-0.9-rollout.md for deployment and acceptance history.
