# Release 0.9 rollout preparation

Status as of 2026-09-28: local preparation only. No hosted writes, deployments, DNS changes, secret changes, builds submitted to EAS, or device acceptance in this preparation pass.

## Native release

App, package and root lockfile versions are 0.9.0. Runtime uses appVersion, so this requires a new 0.9.0 binary. expo-clipboard is a new native dependency. Do not send this release as an OTA update to 0.8.0.

Existing EAS project: d6fa64ff-1623-4776-b302-9ccde3aae84d. Preview profile already uses internal distribution, preview environment/channel and remote automatic build numbering. Keep those settings. Build 26 is the documented previous 0.8 Android build, not a verified current remote counter; let EAS allocate the next number after checking current build/signing state. EAS account access and the actual signing certificate still need verification. Production package remains com.projectlemonade.mvp; development uses com.projectlemonade.mvp.dev.

Do not distribute 0.9 before the sharing metadata/export backend exists: schema-6 export deliberately fails when sharing data cannot be fetched. A disabled public sharing switch does not remove this backend dependency.

## Hosted migration inventory (read-only inspection)

Project mrlumqsdabxptkwmqjwf is active. Hosted migration names and versions were read through the connected Supabase account. Name correspondence is an inventory, not proof of identical SQL or a completed schema comparison.

| Migration | Local version | Hosted version |
| --- | --- | --- |
| create_saved_places | 001 | 20260703082613 |
| prevent_duplicate_saved_places | 20260720045424 | No matching entry |
| separate_favorite_from_lifecycle | 20260802134112 | 20260803055038 |
| add_saved_place_classification_overrides | 20260803050111 | 20260803055056 |
| add_user_managed_tags | 20260803053138 | 20260803055110 |
| create_editable_tag_catalog | 20260803061740 | 20260803065557 |
| add_user_accounts | 20260810161421 | 20260811061415 |
| optimize_user_rls_jwt_lookup | 20260811062749 | 20260811062749 |
| delete_current_user_data | 20260907092257 | 20260907095925 |
| add_saved_place_sources | 20260908010000 | 20260908133544 |
| index_saved_place_source_ownership | 20260908020000 | 20260908133829 |
| add_import_inbox | 20260910162113 | 20260911065626 |
| optimize_inbox_rls_jwt_lookup | 20260911065712 | 20260911065749 |
| add_dining_plans | 20260912132149 | 20260912140840 |
| index_dining_plan_membership_owner | 20260912140936 | 20260912140955 |
| add_map_position_quota | 20260915063806 | 20260916022758 |
| add_map_quota_exemptions | 20260917070126 | 20260917070538 |
| add_place_visits | 20260925094733 | 20260926033821 |
| add_visit_history_page | 20260925100637 | 20260926033846 |
| add_library_visit_summaries | 20260925163101 | 20260926033912 |
| add_plan_sharing | 20260926162945 | Pending |
| sharing_owner_metadata | 20260927065245 | Pending |

Read-only catalog inspection confirmed hosted saved_places has unique indexes on (user_id, source_url) and (user_id, place_id), restricted to non-null owners (and place IDs for the latter). The unmatched historical local migration instead creates global uniqueness and updates source URLs. Do not replay it, infer its data rewrite occurred, or mark its history applied solely from the current indexes. Hosted dining_plans has its (id,user_id) unique key and dining_plan_items has its primary key and membership/owner indexes.

Before applying the two new migrations, compare their required columns, constraints, roles and replaced deletion function against the hosted catalog. Apply only the reviewed new migrations in order through an explicit migration operation, recording returned hosted versions. Do not run an automated whole-directory database push or repair historical entries on name matching alone. No history repair has been performed.

## Deployment sequence to review

1. Select the public origin. Verify Vercel account plan eligibility and project settings; previous inspection found no project in Star Allies. Decide whether a temporary testing address or an owned domain will be used. Cloudflare is optional DNS management, and its setup is unverified.
2. Finish the hosted schema prerequisite comparison. Review the exact two migration files and deploy plan-sharing/shared-plan with sharing disabled. Verify owner authentication, safe metadata/export grants and anonymous denial of private records.
3. Set server-only encryption keys and active key ID through secure provider configuration, exact allowed browser origin, and conservative quotas. Do not put secrets in chat or web/.
4. Build the static site using the approved public shared-plan endpoint, publish only web/, and keep native opening off. Review existing privacy/terms/help drafts before publication. No repository files or local environment files belong in the published directory.
5. Inspect actual platform logging/capture/access/retention and HTTP/cache behavior using disposable synthetic content. Record any unavoidable exposure and obtain the release decision required by the sharing contract before enabling public retrieval.
6. Configure the verified origin for the native preview build. Verify the signing certificate before generating Android association files. iOS association configuration requires separately verified Apple identifiers; omit until available.
7. Build and install Android 0.9, then test owner enable/copy/replace/disable; independent public labels; signed-out recipient cold/warm opening; background/foreground and revoked/deleted links; account switching; schema-6 export; private workflow regressions; keyboard/Back; themes; large fonts and TalkBack. Test browser fallback with no app and an older app. Desktop emulation is not device acceptance.
8. Enable optional native opening only after compatible-binary acceptance. Confirm hosted behavior again before public release. Record deployment IDs, allocated native build number, artifact checksum and acceptance results in final release notes.

## Rollback

Disable SHARING_ENABLED to stop public reads and credential delivery/creation. Owner status, edits, preview and disable remain available. Keep additive tables and private plans; do not drop data or restore a backup that could resurrect bearer credentials without a separate invalidation review. Already delivered copies cannot be revoked. Older exports omit sharing metadata, so an older app is not a complete sharing backup.

## Evidence and remaining inputs

Packages A–F previously passed 204 automated tests, type checking and Android/static web compilation; package B/D also passed disposable database and API checks. These are local evidence, not hosted or physical-device acceptance.

Owner input still needed: domain/testing-origin preference and, later, Android device acceptance. Hosting eligibility, real EAS credentials/signing, server configuration, hosted logging and full schema prerequisite comparison remain open. No private keys should be pasted into chat.

## Hosted backend rollout — 2026-09-28

The owner authorized the backend setup after confirming the Vercel custom domain. The two new migrations were applied individually to mrlumqsdabxptkwmqjwf after a read-only comparison of required columns, ownership foreign keys, parent unique keys, map cleanup routine, and the existing account-deletion function. No historical migrations were replayed or repaired.

| Local migration | Applied hosted version |
| --- | --- |
| 20260926162945_add_plan_sharing | 20260928141614 |
| 20260927065245_sharing_owner_metadata | 20260928141628 |

Both Edge Functions are ACTIVE at version 1: plan-sharing and shared-plan. Gateway JWT verification is off intentionally: owner requests are verified with the existing Clerk issuer/JWKS implementation, and recipient access uses the bearer credential. Each deployed bundle includes its entrypoint, planSharing.ts, planSharingRuntime.ts and clerkAuth.ts. The first owner-function deployment returned a transient provider internal error; one retry succeeded.

Hosted catalog verification: all three sharing tables have RLS and no direct SELECT grants to anon, authenticated or service_role. Anonymous execution of metadata and recipient database RPCs is denied. Authenticated users can execute the ownership-filtered metadata function; the server role can execute the recipient wrapper. Membership invalidation trigger exists. There were zero enabled shares.

HTTP smoke checks with a synthetic dummy token: recipient returned 404 unavailable; unauthenticated owner status returned 401 authentication. Both responses had no-store and no-referrer. This confirms those deployed boundary responses, not authenticated end-to-end/device acceptance or that every secret is configured.

Security advisors reported INFO only: RLS with no policies on the three intentionally private sharing tables and two existing private map quota tables. Those tables are accessed through narrowly granted routines, not direct client policies. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Secret setup remains pending. The local Supabase CLI lacks an access token; the connector was able to deploy but does not expose secret-management tools in this session. No encryption key was generated or printed, no secret was overwritten, and no enable switch was set. The owner needs to sign the CLI in using its normal browser flow before automatic secure secret provisioning can continue. Keep SHARING_ENABLED=false when configuring secrets, and keep the website endpoint/native scheme blank until hosted privacy and acceptance checks are complete.

The static site has now been deployed by the owner and connected at https://share.makeitlemonade.app. Direct HTTPS checks of /s and /sharing-config.mjs returned 200 with no-store/no-referrer; endpoint and nativeScheme remain empty. This supersedes the initial local-only status at the top of this historical preparation record.

## Secret configuration — 2026-09-29

CLI login is now available. Set SHARING_ENABLED=false, SHARING_ALLOWED_ORIGINS=https://share.makeitlemonade.app, SHARING_ACTIVE_KEY_ID=v1, minute limit 120 and daily limit 5000. Automatic approval review blocked the combined random-key generation/upload command before execution; the owner generated the key locally and saved SHARING_TOKEN_ENCRYPTION_KEYS directly in Supabase. Secret inventory confirms all six names exist; key contents were not retrieved or displayed and encryption round-trip acceptance remains pending.

A verification script initially checked a nonexistent digest property (the current CLI JSON exposes name, updated_at and value), so its false comparison did not establish that sharing was enabled. Explicitly setting SHARING_ENABLED=false succeeded again. A synthetic recipient POST from the approved origin returned 404 unavailable with the exact allowed-origin response and no-store. No real share was created and no activation was performed.

Hosted logging review completed read-only on 2026-09-29; see release-0.9-sharing-privacy.md for exact settings, sampled attribute names, owner-confirmed membership and limitations. External exporter inventory and end-to-end content/error checks remain open. No activation occurred.

## Hosted synthetic retrieval test — 2026-09-29

Owner authorized temporary activation for invented content. Confirmed zero active links beforehand. Created one dedicated synthetic owner/plan/place and independent public label through SQL and production management RPCs. Used deliberately dummy credential envelopes and synthetic token verifiers: this exercises database transitions and the deployed recipient endpoint, NOT production-key encryption or Clerk-authenticated owner HTTP requests.

With SHARING_ENABLED=true briefly: initial recipient POST returned 200 with only the public projection; private title/name/address/notes were absent. Replacement through the management RPC made the old token return 404 while the new token returned 200. Disable through the management RPC made the replacement return 404 while the global switch was still on. Response cache policy was no-store.

Reset SHARING_ENABLED=false successfully, deleted the exact synthetic plan and saved place, and verified zero test plans/places/shares and zero active links. Aggregate quota counters and infrastructure metadata from test requests may remain under ordinary retention; no broad log/counter deletion was performed. Website endpoint stayed blank throughout. No policy text was published or real account content shared.

Production-key encryption/recovery and owner HTTP authentication still require a real signed-in test session. No bypass route or new test endpoint was deployed. The user reports no known external log forwarding; this remains owner-reported, not an independently verified inventory.

## Android preview submitted — 2026-09-29

EAS build 76e50ddd-1fa2-4704-8085-3e955e7a9c98 submitted successfully from the local working tree, preview profile, version 0.9.0 / build 27. Existing remote default keystore reused with freeze-credentials; no signing credentials changed. Preview env now includes https://share.makeitlemonade.app. All 204 tests and type checking passed immediately before submission. Source upload completed (about 1 MB). Mobile/backend work remains uncommitted; EAS Git HEAD therefore identifies the earlier website commit rather than all uploaded contents. No OTA/store submission or backend activation occurred. Build completion, APK installation and device acceptance are not yet confirmed.

Build: https://expo.dev/accounts/land-of-poyo/projects/project-lemonade/builds/76e50ddd-1fa2-4704-8085-3e955e7a9c98

## Build 27 device feedback and local follow-up — 2026-09-29

Owner reports existing library/plans/visits intact; sharing controls worked with 20 places; independent public fields, preview, saved state, Back/discard and server-disabled behavior passed. Manual entry was tedious, and the disabled-state error required scrolling to the top.

Local follow-up: moved busy/error/success feedback and refresh recovery outside the form ScrollView into a persistent bottom area. Added an upfront explanation that every place needs an independently authored public name, optional locations, saved-name progress and the ability to finish later. No provider prefilling, API or sharing activation change. Seven owner-sharing tests and TypeScript pass. Build 27 does not contain this follow-up; physical large-font/keyboard review of the revised layout remains pending in the next binary.

## Build 27 owner-link acceptance — 2026-09-29

Owner reports all guided steps passed: enable from reviewed public details, copy canonical custom-domain link, close/reopen and recover identical link, replace and obtain a different link, disable, plus native Share link action. This provides owner-reported device evidence for signed-in owner operations and production-key encrypted recovery. Browser recipient and app-opening behavior were not part of this batch because the website endpoint remains blank. Hosted count after testing: zero active links. Global sharing disable requested immediately after the report; see command result for completion. No user token was requested or recorded.

## Website backend connection — 2026-09-29

Committed and pushed fa6fd1e: generated public endpoint and CSP now point to the deployed shared-plan endpoint. Native opening remains disabled. Nine website tests pass. Live custom-domain configuration confirms the endpoint and empty native scheme, /s returns 200, and no-store remains present. Synthetic API request from the custom origin returns unavailable with matching CORS. Backend remains switched off after the completed owner-control test. Browser/device recipient acceptance is next; publishing the endpoint is not public feature activation.

## Browser device acceptance — 2026-09-29

Owner reports the complete guided browser batch passed: private/incognito access without signing in, public fields/order and map link, saved public-name update after refresh, old-link rejection after replacement with new-link success, and rejection/clearing after disable. Native opening remained hidden. Backend SHARING_ENABLED reset to false after this report. Help/privacy/terms pages were visible; their existence does not finalize the draft policy or complete native/device accessibility acceptance.

## Android App Links preparation — 2026-09-30

Read-only EAS credentials inspection verified preview package com.projectlemonade.mvp and existing default signing SHA-256 DB:C8:23:66:86:A2:22:0B:E5:0A:CB:78:B7:2E:DD:0B:0D:9B:13:F8:FF:70:FF:4B:89:9A:12:7E:B6:C9:35:CE. No private keystore was downloaded or changed. Generated and pushed web/.well-known/assetlinks.json in db536ed. Live HTTPS response is 200/application-json with matching package and fingerprint. This cert is for the EAS preview APK; Play app-signing would require its separately verified certificate.

Preview EAS env now enables Android association for exact https://share.makeitlemonade.app/s. Resolved app config checked. 13 focused recipient/owner tests and TypeScript pass. Submitted 0.9.0 build 28 with existing frozen signing credentials and local feedback improvements. Build ID d0905ea3-24cf-4fe8-aad9-55b22725af88; upload completed. Build completion/install and Android OS association verification remain pending. Backend remains off and browser native-opening button remains hidden.

https://expo.dev/accounts/land-of-poyo/projects/project-lemonade/builds/d0905ea3-24cf-4fe8-aad9-55b22725af88

## Build 28 Android acceptance — 2026-09-30

Owner reports all six guided steps passed: upfront public-name explanation/count and persistent feedback, creation/copy of a synthetic plan link, Android App Link opening while app is running, opening after swiping app away, signed-out public read-only viewing without owner controls, and unavailable/cleared content after owner disable. These are owner-reported physical Android results. iOS remains unverified. Backend SHARING_ENABLED successfully reset to false after the report. Remaining checks include schema-6 export/deletion, accessibility and browser fallback; optional web native-open button remains hidden.

## Prerelease activation — 2026-09-30

After publishing v0.9.0, the owner explicitly authorized ongoing sharing activation. SHARING_ENABLED=true was set and verified against the stored secret digest. Earlier disabled-state entries document temporary test windows and are superseded by this activation. Build 28 and the existing deployment remain in use; no new APK or tag change is required.
