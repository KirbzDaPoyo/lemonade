# Release 0.9 — Package E public recipient page

Status: implemented and verified locally. No hosted changes, provisioning, deployment, DNS or credentials were made.

## Delivered

`web/s.html` is a responsive, read-only shortlist at `/s#<token>` with the public title, existing membership order, safe Google Maps actions, product explanation, sharing help/privacy/terms links, loading, empty, unavailable, busy and connection-failure states. It requires no account or installation. The local Barlow Condensed face and light/dark palette inherit the approved Synthetic Editorial identity. “Open in Lemonade” is deferred to Package F because a verified public app route does not exist yet.

`npm run build:web` produces a dependency-free browser copy of the same strict response parser used by owner preview, an endpoint-only configuration module, and Vercel headers. Native code and database schema are unchanged in E. Default checked-in configuration has no endpoint and cannot retrieve real content; deployment preparation must explicitly set the approved `LEMONADE_SHARING_API_URL`. See web/README.md for the static publishing boundary.

Only a canonical 43-character token in the fragment of `/s` or `/s.html` is accepted. Query strings and encoded/ambiguous tokens fail closed. Retrieval is a POST body to the fixed endpoint with no credentials, no referrer, no-store and redirect refusal. The response is streamed under a 64-KiB cap, must be JSON, and must match the exact 20-place schema and reconstructed map URLs. Text is rendered through textContent and DOM creation. Generic document/social metadata never receives the plan title. The skip control focuses main without replacing the token fragment.

Displayed content is cleared before every new retrieval and on page hiding/leaving; visible re-entry and persisted pageshow restoration refetch. Late responses are discarded. Requests time out after 15 seconds. No automatic write, background polling or stale/offline content fallback is introduced. An existing service-worker controller causes retrieval to fail closed. No workers are registered and CSP prohibits workers; use a dedicated clean sharing origin rather than reusing one with legacy worker scopes.

No third-party code/assets, app analytics, error reporter, localStorage, sessionStorage, IndexedDB, cookies or request/content logs are added. Only explicit map clicks reach Google. Maps open with noopener/noreferrer and no-referrer. All static responses declare browser/CDN/Vercel-CDN no-store and noindex/nofollow/noarchive; robots.txt excludes /s and no sitemap is added.

## Hosting inspection and release gates

Read-only Vercel connector inspection found the connected **Star Allies** team and an empty project list. Neither repository root nor web/ had a linked `.vercel/project.json`. There is no verified hosted Lemonade recipient deployment in that scope, so actual access logs, retention, cache overrides, toolbar injection, redirects and domain eligibility cannot be reported as tested. No account settings were changed. Cloudflare/domain configuration and Supabase hosted invocation capture were not inspected during E.

The URI fragment does not appear in the ordinary Vercel shell request, but the bearer reaches Supabase in the POST body. Supabase documents request/response inspection in invocation logs. Application silence cannot guarantee the platform does not capture it. Browser history/sync, clipboard, extensions, support captures and recipient copies can also retain it. No zero-retention promise is made.

Before publication:

1. Choose and approve the real origin, hosting project/plan eligibility, support details and reviewed policy drafts. Configure no injected toolbar, third-party analytics, cache rules or legacy service worker on the sharing origin.
2. Reconcile/apply the B/D migrations and deploy functions with sharing off. Set reviewed encryption keys and allowed origins server-side; build E using the approved public endpoint. No service key is needed in the web page.
3. Inspect actual Supabase invocation/PostgREST/database/error logs with disposable synthetic credentials and record capture, access and retention. If tokens or content cannot be excluded, document that exposure and get the explicit release decision described in A.
4. On the hosted domain, inspect HTML, JS, redirect and API response headers and browser network traffic. Confirm no-store across browser, Vercel, Supabase and any Cloudflare proxy; no token in shell requests or referrers; no injected third-party code; no service-worker control. Confirm generic social metadata, noindex and no sitemap entry.
5. Test committed disable/replace/delete after successful retrieval, refresh, back/forward restoration, background/foreground, offline failure, malformed links and anonymous access. Check Android Chrome and iOS Safari separately; this turn's desktop browser emulation is not native mobile evidence.

Do not activate `EXPO_PUBLIC_SHARING_ORIGIN` in distributed builds until the real page and backend are verified. Package F owns installed-app opening, associations and signed-out/cold-start handling.

## Verification evidence

Automated tests cover strict token routing, bounded/MIME-checked responses, unknown fields, unsafe maps, text-node rendering, retrieval options, successful view followed by revoked retrieval, hidden/restored-page refetch, stale-response invalidation, empty/network states, keyboard skip preserving the fragment, generated parser parity and security headers. The whole app regression suite and TypeScript check run alongside these tests.

Local Edge browser with synthetic fixtures: desktop 1280px light and mobile 390px dark screenshots; no browser errors; valid maps use noopener/noreferrer; zero localStorage entries; generic document title. HTML-like title/name renders as literal text with zero injected images/scripts. A 320px viewport at 200% text size with 20 maximum-length places initially revealed a header overflow; flex wrapping fixed it and the repeat check reports no horizontal overflow. Revoked fixture refresh removes the previous list. No real account content or link was used.

The design detector ran in degraded regex mode because its optional parser modules were absent, so it was not treated as a contrast/accessibility pass. Browser rendering and a separate bounded finish review supplement it. Screenshots and local test logs are under dist/release-0.9-e-* (ignored artifacts).

No new Google/Apify lookup is introduced. Ordinary opens/refreshes/re-entry incur static hosting traffic and a Supabase invocation plus its bounded database quota/read work and up to 64 KiB egress. These are not guaranteed free. No timer-based polling is used.

## Sources checked

- [Vercel cache-control headers](https://vercel.com/docs/caching/cache-control-headers): no-store and browser/CDN header handling; actual project overrides remain unverified.
- [Supabase function logging](https://supabase.com/docs/guides/functions/logging): invocation request/response visibility; actual account capture and retention remain unverified.

## Final local verdict

197 tests pass, TypeScript passes, the static web build succeeds, and diff whitespace checks pass. The synthetic fixture server and isolated browser session were stopped after verification.

| Review | Result |
| --- | --- |
| Material usability defects | None found |
| Material accessibility defects | None found |
| Material privacy-rendering defects | None found |
| Bounded finish review | PASS |

The separate reviewer inspected source and desktop/mobile screenshots. Calculated contrast was 6.36:1 for light secondary text, 6.52:1 for light actions, 9.74:1 for dark secondary text and 8.93:1 for dark actions. The 320px/200% browser check was performed by the implementation pass, not independently repeated by the reviewer. The scoped design record is web/DESIGN.md.
