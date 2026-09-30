# Release 0.9 — Package B: secure sharing backend

Status: local backend implemented and verified. Sharing remains off by default. Nothing deployed; no app controls, browser page or device acceptance is included.

## Delivered

- `20260926162945_add_plan_sharing.sql`: private sharing state, membership-scoped independently authored public labels, usage counters, narrowly granted RPCs and deletion integration. No anonymous grants or policies added to private product tables.
- `plan-sharing`: existing Clerk authentication followed by transactional ownership checks for status, preview, label/title editing, enable, retrieve, disable and regenerate.
- `shared-plan`: anonymous bounded POST retrieval, token verification, quotas and strict field projection. Never selects legacy venue names, addresses, notes or source metadata. A validated Google Place ID may contribute to a reconstructed destination URL.
- Shared implementation in `_shared/planSharing.ts` and `_shared/planSharingRuntime.ts`; entry points and explicit gateway configuration in `supabase/config.toml`.
- 256-bit random tokens, indexed SHA-256 verifiers and AES-256-GCM encrypted owner retrieval. Encryption binds the plan and credential revision. Title/label edits advance management revision without breaking decryption.
- Parent locking, expected revisions and stable request identities prevent concurrent regeneration from silently overwriting results. Exact retries of the latest request return the committed outcome; mismatched/superseded requests conflict.
- Plan/place membership cascades remove sharing/presentation data. Account deletion clears owner quota records and retains the prior deletion response signature and map-usage cleanup.
- Tests, local database/HTTP fixtures, package test registration and commented server configuration examples. No new application dependency, external service or provider call.

## Owner API

Read: `{ planId, action: "status" | "preview" | "retrieve" }`.

Mutation: `{ planId, action, expectedRevision, requestId, payload? }`. Use a stable UUID for each intended operation; retry a lost response without changing its revision or payload. After conflict, refresh state before a deliberate new operation.

Mutation actions: enable, disable, regenerate, title, label. Title payload: `{ title }`. Label payload: `{ savedPlaceId, name, location: string | null, provenance: "owner_authored" }`. No provider prefilling. Software records an explicit authorship assertion; it cannot establish independently that a person authored the text.

Responses include enabled, revision, public title and creation/update timestamps. Preview adds the eligible public projection or null. Only enable/regenerate/retrieve may return a token. Ciphertext and verifier never leave the handler. Client-supplied owner identities and unknown fields are rejected.

Empty plans can be shared. Any unlabeled member makes enablement fail and an existing public link unavailable until resolved. Removing and re-adding a member requires a new label. Completion/reopening does not revoke a link. Disable removes credential material and works even with missing encryption keys.

Privileged implementations live in the private schema. Public-schema wrappers are security invokers; both layers revoke ordinary client execution and grant only the server role. Each management transaction rechecks ownership using the server-verified Clerk subject. Recipient retrieval has no plan-ID access path.

## Bounds and Package A refinements

- Public request maximum 2 KiB; owner request maximum 16 KiB, enforced while streaming even without Content-Length.
- Public output maximum 20 places/64 KiB UTF-8 JSON. Destination URLs have a stricter 1,024-byte cap, within A's 2,048-byte ceiling; longer destinations become null to reserve room for Unicode labels.
- Public and owner endpoint scopes each admit at most 120 requests/minute and 5,000/UTC day. Owner operations also cap at 30/account/minute. Project overrides only lower ceilings; invalid overrides become zero.
- No IP header is trusted yet. A's global-limiting fallback is used; source-specific throttling waits for a verified hosted header trust boundary. No raw IP or quota-hash key is needed.
- Quotas are atomic. Counters retain today/yesterday and are pruned on requests using an expiry index. Global admission caps bound per-owner bucket creation. Account deletion removes its subject buckets; aggregate counters contain no account identity.
- Limiter failures deny retrieval. Rejected requests and ingress still consume resources; these limits do not guarantee zero cost or bound all invocation charges.
- The global switch blocks public reads and owner enable/regenerate/retrieve. Status, preview, label/title edits and disable remain usable. Administrative server-role RPCs remain callable; the switch is enforced at Edge entry points.
- All responses include no-store, no-referrer and noindex headers. Invalid/revoked/deleted/ineligible links share generic unavailable responses. No application logging or public-view analytics was added.
- Schema-6 export integration remains a later owner-controls task. Existing app export stays schema 5; there is no mobile sharing UI yet. Do not enable hosted sharing before the remaining release gates.

## Configuration and cost

Commented examples in `.env.example` are server-only, never Expo public or browser values:

| Supabase secret | Purpose |
| --- | --- |
| SHARING_ENABLED | Literal true enables credential operations/public reads; default off. |
| SHARING_ALLOWED_ORIGINS | Comma-separated exact browser origins; absent denies browser-origin requests. CORS is not authentication. |
| SHARING_TOKEN_ENCRYPTION_KEYS | JSON mapping of 1–4 key version IDs to 32-byte unpadded base64url keys. |
| SHARING_ACTIVE_KEY_ID | Encryption version for newly generated credentials. |
| SHARING_MINUTE_LIMIT | Downward project override, default 120 per endpoint scope. |
| SHARING_DAILY_LIMIT | Downward project override, default 5,000 per endpoint scope. |

Existing Supabase URL/service-role and Clerk issuer/JWKS conventions are reused. Tests use random disposable credentials. No user key-setting or dashboard action is required now.

Retain old key versions while their links remain active. Lost keys prevent owner recovery, but disablement still works; public verification deliberately does not decrypt. Disable affected links before retiring a key if ongoing public access is unwanted. Key setup, origin selection and hosted logging review belong to authorized rollout.

A normal view adds one function invocation, bounded quota writes and an indexed share/member read, with at most 64 KiB content egress. No Google, Apify, email, image storage, polling or public analytics calls. Hosting/function/database allowances still require review before deployment.

## Verification

| Check | Result |
| --- | --- |
| Baseline regression suite | 171 passed |
| Updated regression suite | 177 passed |
| Application TypeScript | Passed |
| Deno check of both Edge entry points | Passed, temporary pinned Deno 2.9.6 |
| Full local migration chain | 21 migrations applied to disposable PostgreSQL 17 |
| Sharing database suite | Passed ownership/grants, projection, eligibility, ordering, retries, overlapping regeneration, quotas, revocation and deletion isolation |
| Existing journal database suite | Passed with replacement account-deletion function |
| Local HTTP/Supabase-client sharing suite | Passed direct RPC denial, owner boundary, encrypted recovery, anonymous projection, regeneration, disable and account deletion |
| Existing HTTP regressions | Passed, including 406 library summaries and 1,051 private export entries |
| Local Supabase advisors | No issues |

The advisor's generic remote-database message refers to the explicit disposable 127.0.0.1 address, not hosted Supabase.

Commands: `npm test`; `npm run typecheck`; `node script/verify-visits-native.cjs --sharing`; `node script/verify-visits-native.cjs --api-only --sharing`. The existing runner accepts `--sharing` to include this package's fixtures. Ignored logs are under `dist/release-0.9-b-*`.

The missing temporary PostgREST executable was restored from official release 16.3 and verified against its published SHA-256. An initial HTTP fixture needed an async wrapper for the CommonJS test runner; the corrected fixture passed. Temporary tools are outside app dependencies. No configured lint pass is claimed.

HTTP tests inject a local identity resolver; they do not verify hosted Clerk/JWKS issuance or Edge gateway behavior. Deno checks entry-point types; handler behavior runs under Node Web APIs with real local database/HTTP operations. Hosted logs, capture/redaction/retention and native/browser acceptance remain unverified.

No mobile/web app build was run for this backend-only package; both Edge entry points were checked. App/browser builds and device acceptance belong to their implementation packages. No iOS claim.

## Handoff

Package C next: review the public-content/preview experience and remaining privacy gates using the approved independent labels. Owner controls and schema-6 export follow in D, browser page in E, native links in F.

Rollout remains additive and explicitly authorized, initially with sharing off. Reconcile historical hosted/local migration IDs before pushing migrations. Rollback disables sharing and preserves private plans and presentation data. Backup restoration must not resurrect old credentials without an invalidation review. Infrastructure request/response logging is still a release gate.

References: [Package A contract](release-0.9-sharing-contract.md), [Supabase function authentication](https://supabase.com/docs/guides/functions/auth), [database functions](https://supabase.com/docs/guides/database/functions). The changelog Markdown fetch failed; existing pinned CLI behavior and current topic documentation informed implementation. No hosted eligibility/retention claim is made.
