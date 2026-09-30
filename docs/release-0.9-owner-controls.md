# Release 0.9 — Package D owner controls

Implemented locally; no hosted migrations, deployments, keys, DNS changes or releases were made.

The existing outing-plan screen opens a dedicated, account-scoped sharing editor. It supports independently authored public title/names/optional locations, server-produced recipient preview, explicit enable after disclosure, copy, native text share, public-page opening, confirmed disable and confirmed replacement. Tokens are retrieved only for an explicit copy/share/open action, remain transient, and are never rendered, cached, exported or logged by these controls. Disabling and replacing cannot retract screenshots, already displayed content, clipboard/history entries or other saved copies.

Public labels start blank and the public title starts as “Places to try”; imported provider text and the private title are not used to fill these fields. Places follow the existing shortlist order. Saving one field preserves other drafts. Back protects unfinished edits and dismisses the keyboard first. The editor uses the existing theme, scalable text, scrollable layout, large controls and reduced-motion preference.

Writes are serialized and never automatically retried. An uncertain result clears the preview and requires status refresh; no optimistic enabled/disabled/replaced state is shown. Explicit validation/rate-limit failures preserve editable drafts. Account changes, sign-out and data deletion invalidate pending results and block late native delivery. Both metadata and management requests have a 20-second network timeout. The server remains responsible for ownership, eligibility, revision conflicts and request deduplication.

The additive `20260927065245_sharing_owner_metadata.sql` migration exposes only owner-scoped, explicitly selected metadata through authenticated functions. Anonymous and foreign-account access are denied. Export uses pages of at most 25 sharing records and continues until exhausted. Membership insert/delete invalidates a reviewed sharing revision. Existing plan, saved-place and account deletion cascades revoke links/remove labels.

Export schema 6 preserves all previous fields and adds `data.planSharing`: status, public title, revision, timestamps, and ordered independent labels. Bearers, encrypted credentials, verifiers and working links are excluded at both database and serializer boundaries. Any failed page stops export. Apply both sharing migrations before distributing this client; the older hosted schema cannot provide a complete schema-6 export.

## Rollout prerequisites

- Package E must provide the recipient page at `/s#<token>` before links are offered to users.
- Leave `EXPO_PUBLIC_SHARING_ORIGIN` blank until the approved HTTPS origin serves that page. No fallback domain is invented. A blank value disables enable/copy/share/open/replace while retaining editing, preview and revocation.
- Deploy the owner/public functions, migrations and reviewed server settings from package B before using this build against hosted data. Confirm CORS, key management and log/body retention as recorded in the earlier sharing documents.
- `expo-clipboard` 8.0.8 was installed using Expo's SDK-compatible installer. This is a native dependency: produce a new Android development/release binary; do not send this JavaScript to the old 0.8 binary as an OTA-only update. [Expo SDK 54 Clipboard documentation](https://docs.expo.dev/versions/v54.0.0/sdk/clipboard/).
- Existing dependency audit/Clerk peer-version warnings remain; no unrelated automatic upgrades were applied.

## Verification

All 189 regression tests pass; all 7 owner-sharing tests were rerun after the final UI adjustment. Type checking and diff whitespace checks pass. Local regression and focused owner-session/component tests cover draft preservation, review gating, failed enable, schema allowlisting, multi-page export and failure, duplicate actions, revoked retrieval, account switch/sign-out, and export invalidation. Disposable PostgreSQL applies all 22 migrations and verifies actual ownership/grants, metadata privacy, revision invalidation, live cleanup and deletion. Local PostgREST exercises the production handler and mobile session with fixture authentication; it does not claim a hosted Clerk check.

Android JavaScript/Hermes bundling is checked locally. No Android device/emulator or iOS runtime testing was performed in this turn, so native clipboard/share-sheet behavior, font scaling, keyboard/back interaction and light/dark appearance still require device acceptance on the new binary. The public page itself belongs to package E and is not yet implemented.
