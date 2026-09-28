# Release 0.9 — Package A sharing contract

Date: 2026-09-27. Status: Package A complete; owner approved independently authored public place names and optional location text. Package A implements no feature, migration or deployment.

## Repository findings

The working tree was clean. No AGENTS.md was found in the inspected repository guidance locations or checked ancestors. The supplied release brief and release records govern this package. Secrets and hosted account settings were not inspected.

| Area | Evidence and consequence |
| --- | --- |
| Plans | `src/types/dining-plan.ts`, `src/repositories/plans/plans-repository.ts`, `src/store/plans-context.tsx`: existing private outing plans, account-scoped state, stale-response guards. Reuse these; no collection system. |
| Membership | `20260912132149_add_dining_plans.sql`: serialized 20-place cap, same-owner composite foreign keys and deletion cascades. Ordering is creation timestamp then membership ID, ascending. No reorder operation exists. |
| Identity | Clerk JWT subject owns records. Private tables revoke anonymous grants and enforce RLS. `_shared/clerkAuth.ts` verifies Clerk JWTs. Existing Edge Functions disable gateway JWT verification and authenticate in their handlers. |
| Provenance | `place-search/index.ts` maps Google displayName, formattedAddress, address components and googleMapsUri. `v2-candidate-match-screen.tsx` saves these through `SupabaseSavedPlacesRepository.ts`. Saved fields have no field-level provenance, provider-reuse expiry or attribution records. |
| Navigation | `app/_layout.tsx` protects the app group with sign-in. Existing share routing handles Instagram imports, not public plan recipients. |
| Native | Production scheme is `project-lemonade`; package/bundle ID is `com.projectlemonade.mvp`. Development has a separate scheme/package. Runtime policy is `appVersion`. No web-domain association is configured in inspected app configuration. |
| Web | `web/` has deletion, privacy and terms drafts, CSS and restrictive Vercel headers. Its README understates the extra pages. No dynamic sharing app exists. |
| Maps | `src/services/map-handoff.ts` constructs destinations without provider requests. Its accepted stored URLs/queries are broader than appropriate for public output; reconstruct public URLs explicitly. |
| Export/deletion | Schema 5 explicitly maps private plans and visits. Account deletion deletes plans; membership deletion cascades. Preserve existing deletion return signatures. |
| Quotas | Private map counters and narrowly granted service-role RPCs supply a pattern, but sharing must have independent counters. |
| Monitoring | PostHog has allowlisted events and no replay/lifecycle capture. Sentry scrubs requests/breadcrumbs/sensitive keys. Raw tokens and custom-scheme links still need explicit tests. |
| Validation | Existing Node/tsx tests, component harness and local PostgreSQL/PostgREST scripts can be extended. No configured lint script. |

Release 0.8 records Android build 26 and owner acceptance, with device account-deletion and TalkBack/reduced-motion checks skipped. iOS is unverified. Local and hosted migration IDs differ: reconcile history before any future push; do not reapply the recorded hosted migrations.

## Public fields and approved content direction

Successful output has exactly this shape, with no extra keys:

```ts
type PublicPlan = {
  schemaVersion: 1;
  title: string;
  places: Array<{
    name: string;
    location: string | null;
    mapUrl: string | null;
  }>;
};
```

Limits: separate public title 1–80 Unicode code points, eligible name 1–200, optional eligible address OR area at most 300, validated destination URL at most 2,048 bytes, at most 20 places, total UTF-8 JSON at most 64 KiB. Array order represents membership order; return no ordering IDs/timestamps. Empty plan returns an empty list. Reject oversized output rather than silently truncating destinations. Default public title: `Places to try`; never prefill from the private title.

Exclude private title/description/trip dates, account information, internal record IDs, notes, journals, ratings, visit dates, favorites, tags, lifecycle status, sources/Instagram URLs, captions/creators, import metadata, photos/enrichment, coordinates/distance/map-session data and credentials. A Google provider Place ID may appear inside a supported map destination, never as a separate field or access credential.

**Legacy venue fields are not approved for automatic public republication.** Current Google policy restricts stored Places content, with an explicit indefinite-storage exception for Place IDs. Attribution does not establish reuse permission. Candidate confirmation does not make Google-derived text independently authored. Neither a missing Place ID nor an editable field proves safe provenance. Existing Instagram-derived or mock data must not be relabeled as verified owner content either.

Owner decision recorded 2026-09-27: adopt option 1 below. Option 2 remains an unapproved alternative and is not part of the implementation plan.

1. Recommended low-cost option: independently owner-authored public place names and optional location text, attached to existing memberships with provenance. Do not prefill from provider content or encourage copying it as a workaround. This adds setup effort; the owner explicitly approved that product-scope adjustment.
2. Automatic reuse of existing venue names requires establishing an applicable provider permission and retaining required provenance/attribution. Package A established neither. Do not silently introduce live Google lookups; the brief forbids new provider requests for sharing.

This envelope is a field ceiling, not permission to expose existing saved fields. Lifecycle/security work can use synthetic fixtures. Real enablement must fail closed if any member lacks an eligible public name. If a later membership addition becomes ineligible, the public page returns generic unavailable until resolved, rather than silently showing an incomplete recommendation list. Optional ineligible location becomes null. Owner UI must explain this behavior. Check eligibility on every read, including changes by older clients.

If approved Google content is eventually displayed, follow current Google Maps branding and any third-party attribution requirements, using local assets. If fixed attribution cannot satisfy those requirements, revise the response contract before implementation. No photos, ratings or new provider calls. Publishing existing policy drafts requires the later rollout authorization.

## Sharing lifecycle

- Private by default; one state row and one active credential maximum per plan, enforced in the database.
- Active pages reflect current memberships and existing order on retrieval. Completion/reopening does not disable sharing. Private title edits do not alter the public title. Do not add a reorder feature just for sharing.
- Owner operations: status, preview, enable, retrieve existing link, edit public title, disable and regenerate. Preview uses the same projection/eligibility rules as retrieval.
- Every operation, including preview/status/link retrieval, verifies current Clerk identity and plan ownership. Never trust a client-supplied owner ID. Privileged management transactions repeat the ownership check using only the server-verified subject.
- Enable when already active returns the same link. Re-enable after disable issues a new token. Regenerate requires active state and explicit UI confirmation. Disable is repeatable and clears recoverable credentials.
- Mutations have a stable request UUID, payload digest and expected revision. Serialize on the parent/share state with consistent lock order. Exact retry of the latest committed request returns its outcome without another mutation. Different payload or superseded request returns conflict without recovering an old token. Concurrent regeneration at one revision yields one success and one conflict. Clients reconcile state before deliberately retrying a conflict.
- Lost responses must not falsely show success or provoke a new rotation. Preserve confirmed state, reconcile status, and retry the same request identity. Account changes clear transient credentials and reject late responses.
- Plan deletion cascades sharing records; saved-place deletion removes membership/presentation data; account deletion invalidates all its plans' links. Preserve private data lifecycle and deletion signatures.

Before enablement, explain visible fields, anyone-with-link forwarding, live updates, and that disablement cannot retract screenshots or copies. Include loading, empty, disabled, error, confirmation and retry states, accessibility, keyboard behavior and both themes.

## Credential and backend model

Generate 32 random bytes server-side using Web Crypto, encoded as 43 unpadded base64url characters: 256 bits of entropy. Validate exact token grammar/size. Never encode a plan or account ID as a credential.

Store an indexed SHA-256 verifier for lookup. For cross-device copying of the same link, also store an authenticated-encrypted token in a private, unexposed table. Use AES-256-GCM with a fresh nonce, versioned Supabase-only encryption key, and plan/revision associated data. This deliberately is not hash-only storage: a verifier cannot recover a random token. Ordinary client reads must expose neither ciphertext nor verifier. Public lookup never decrypts; owner retrieval decrypts only after ownership verification. Standard crypto only, no custom primitives.

Return a credential only from explicit enable/retrieve/regenerate operations, with no-store responses. No tokens in status, preview, exports, ordinary mobile preferences or browser storage. Test nonce handling, wrong keys and associated-data failures. Retain required key versions during controlled rotation or deliberately invalidate affected links. Missing keys fail closed. Disable/delete must remain possible when decryption is unavailable. Backup restoration must leave global sharing off until credential invalidation is reviewed.

Proposed Edge Functions: `plan-sharing` for authenticated management and `shared-plan` for anonymous token retrieval. A narrowly granted service-role RPC performs verifier/active-state validation and explicit field projection in one database snapshot. Use private tables, RLS defense in depth, explicit privileges, qualified names and empty search paths. Revoke privileged RPC access from PUBLIC, anon and authenticated; grant only the server role. No anonymous read policies on plans, saved places, sources or visits. Ordinary owner reads should retain authenticated RLS where possible.

Public request: POST to a fixed endpoint with `{ token }`; no token in endpoint path/query. JSON limit 2 KiB; reject unknown fields and unsupported methods. Owner requests have a 16 KiB ceiling, to revisit only if the approved label-editing design needs more. No recipient authentication/session required.

Unknown, disabled, deleted, replaced or ineligible links all yield 404 `{ "error": "unavailable" }`. Operational failures use generic 503; rate limits use 429 with bounded Retry-After. All responses are no-store. Requests beginning after committed revocation must fail; an already executing request can have observed prior state. No claim of retracting delivered content.

## Abuse controls and cost

Use independent atomic private Postgres counters. Initial validation defaults: public project 120 requests/minute and 5,000/day, trusted source bucket 30/minute, authenticated management 30/account/minute. These are conservative engineering limits, not free-tier guarantees. Bound source bucket creation and prune expired windows. Retain no raw IP/token; use short-lived keyed source hashes. Trust source-IP headers only after verifying the platform boundary; otherwise retain global limiting. No map-quota exemptions.

Count invalid retrieval attempts, check quotas before content lookup, fail closed on limiter failure, and provide a server-side sharing switch off by default. Allow lowering hard limits. OPTIONS is content-free and creates no source buckets. CORS permits configured web/local origins with no credentials, but is not authorization or protection against non-browser clients.

Abusive requests still consume ingress, function invocations and limiter work: these limits do not guarantee zero cost. Per ordinary view expect static Vercel traffic, one Supabase invocation (possibly a preflight), bounded quota writes and an indexed share/member read, with at most 64 KiB output. No Google, Apify, image storage, email, polling or public analytics requests. No new paid limiter service.

## Web and app links

Extend `web/` with a small same-origin HTML/CSS/JavaScript shell hosted on Vercel that retrieves current content from Supabase. Dynamic browser data does not require a new Next.js app or server-rendered content. Vercel holds no backend secrets or authorization logic. Existing policy pages remain static.

Proposed URL: `https://<approved-sharing-host>/s#<token>`. Read the fragment in memory and POST it to Supabase. Fragments are not sent in the Vercel page request. Use generic page/social metadata, noindex/nofollow/noarchive, no sitemap entry, no third-party scripts/fonts/assets/analytics/replay or injected preview toolbar. Restrict CSP connections to the approved Supabase origin and set no-referrer.

No localStorage, sessionStorage, IndexedDB or offline persistence. Retain the fragment so reload and copying work. Browser history/sync, extensions, clipboard and messaging services can still retain the bearer link; this application cannot promise otherwise.

Escape text through text nodes/React, never HTML interpolation. Reconstruct destinations with exact supported HTTPS Google host/path/query rules; reject arbitrary stored parameters, tracking fragments, credentials and unsafe schemes. Do not resolve short links server-side. Use noopener/noreferrer on external actions. Recipients never navigate to private plan/place screens.

Shared shell and all data/error responses use no-store, without CDN overrides, ETag/304 content reuse, framework caching, stale-if-error, service worker or offline fallback. Static assets can be cached only because they hold no content/credentials. Clear and refetch on browser pageshow restoration and app foreground/re-entry. No polling; an already open page or screenshot cannot be remotely erased.

Add a dedicated recipient route outside protected app screens. Parse only approved production/development schemes and exact HTTPS origin/path with strict token grammar; reject ambiguous encodings. Do not confuse these with Instagram import intents. Explicit browser action may use `project-lemonade://shared#<token>`; preserving the fragment through Expo Router and Android cold starts must be tested in F. Never move tokens into logged routes for convenience.

Prepare Android association files with real signing fingerprints and hostname, and iOS files only with verified identifiers. Do not invent domain/store links. Browser fallback must remain usable without the app. Recipients must not hydrate owner providers or wait for sign-in. An appVersion runtime requires compatible native distribution; do not assume OTA compatibility with build 26.

## Logging and hosting gates

Fragment URLs keep credentials out of ordinary page-request URLs, not out of all infrastructure. Supabase receives tokens/content over TLS. Its documentation describes invocation views containing request/response headers and bodies. Application scrubbing alone cannot prove those records are absent.

Before rollout, use synthetic credentials to inspect Supabase invocation, PostgREST/database and exception logs, recording actual capture/redaction, access and retention. Inspect Vercel/Cloudflare logs, redirects, proxy/cache rules, deployment protection and injected tools too. No hosted settings were verified in A. If capture cannot be disabled/redacted, document unavoidable exposure and obtain a release decision. Moving the token between body and headers is not proof of protection.

Extend fixed owner telemetry actions only: enabled, disabled, regenerated, preview_opened, link_copied, share_opened. No public-view tracking. Never include titles, IDs, URLs, content or requests. Test raw token strings, nested errors, custom schemes, fragment URLs and navigation state against scrubbing.

Vercel Hobby is currently for personal non-commercial use; pre-revenue status alone does not establish eligibility. Account plan and intended-use eligibility remain unverified. Cloudflare remains DNS/existing network protection, with no Worker required. Select the existing domain/subdomain with the owner at rollout and verify all cache overrides and association files. No purchases, provisioning, deployment or DNS changes are authorized.

## Export, configuration and rollout

Implementation should extend export to schema 6 with sharing enabled state, public title and relevant timestamps. Include the approved independently authored presentation fields. Omit tokens, working share URLs, hashes, ciphertext, nonces, keys and request identities. Preserve all schema-5 fields. Document deletion/counter retention and ensure account-scoped abuse data is removed on deletion.

Proposed configuration, finalized in later packages: public mobile sharing base URL; Supabase-only global switch, versioned encryption keys/active version, quota-hash key, allowed web origins and downward limit overrides. Web needs only the public function URL and any required publishable key. Missing configuration disables activation. No new credentials are needed for A. Do not edit `.env.example` until implementation establishes actual variable names.

Rollout order: resolve content eligibility; validate additive migration locally; reconcile history; obtain authorization; apply with sharing off; configure secrets/functions; publish web/policy pages and associations; test compatible Android build, synthetic links/logging/revocation; deliberately enable. Rollback switches sharing off first and preserves private plans and additive user data. Do not resurrect previous credentials. Older clients remain compatible but schema-5 exports omit sharing state.

## Acceptance checklist for subsequent packages

| Gate | Evidence required |
| --- | --- |
| Ownership | Two-account denial for every management/read/credential operation; invalid Clerk tokens and spoofed owner IDs rejected. |
| Database | Anonymous private-table denial, direct privileged-RPC denial, explicit grants, security advisors. |
| Lifecycle | Entropy, encryption, retry/lost response, payload mismatch, concurrent regeneration, superseded request, disable/re-enable. |
| Projection | Exact keys, eligible provenance, no private values, maximum 20 entries/64 KiB, escaped text, safe destinations. |
| Updates | Membership/order changes, empty/completed plans, old-client edits, ineligible additions, removal/plan/account deletion. |
| Revocation | A previously successful request followed by disable/regenerate/delete fails on subsequent retrieval, including restored browser pages. |
| Abuse | Concurrent quotas, body limits, spoofed headers, bounded counter growth/pruning, limiter outage and direct endpoint attempts. |
| Logging | Synthetic credentials across adapters/functions/hosted logs with actual retention documented. |
| Native/web | Signed-out/cold/warm starts, absent app, bad/revoked links, browser fallback and deployed association evidence where available. |
| Regression | Existing import/library/plan/map/journal/account/export/delete tests, typecheck, local full migration chain, Android/web builds. |
| Manual | Owner actions, mobile/desktop layouts, keyboard, large text, themes/accessibility; Android and iOS evidence separately recorded. |

## Package A handoff

Only this document changed. No migrations, dependencies, environment changes or dashboard setup. Validation comprises source inspection, official documentation review and document checks, not feature tests or builds. The owner approved the independent public-content path. Next is Package B's local security implementation, including membership-scoped public names and optional location text; do not automatically populate them from saved provider fields. Hosting eligibility, log behavior and native associations remain release gates, not claimed passes.

## Sources checked 2026-09-27

- [Google Places policy](https://developers.google.com/maps/documentation/places/web-service/policies): content storage exceptions and attribution.
- [Google Maps Platform terms](https://cloud.google.com/maps-platform/terms): stored/reshared content restrictions. Account-specific and billing-region permissions were not established.
- [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started): supported destination construction.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): privilege and ownership boundaries.
- [Supabase logging](https://supabase.com/docs/guides/functions/logging): invocation request/response visibility, with actual retention unverified.
- [Supabase changelog](https://supabase.com/changelog): HTML fallback available; the Markdown index failed retrieval. No exhaustive breaking-change audit claimed; recheck implementation APIs in B.
- [Vercel Hobby](https://vercel.com/docs/plans/hobby): non-commercial eligibility and bounded allowances.
- [Vercel logs](https://vercel.com/docs/logs): plan-dependent retention; the runtime detail page failed retrieval during inspection.
- [Cloudflare cache control](https://developers.cloudflare.com/cache/concepts/cache-control/): no-store behavior, subject to hosted rule verification.
- [URI fragments](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment): fragments excluded from server requests.
