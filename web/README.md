# Project Lemonade static web

Package E adds a recipient page at `/s#<token>` to the existing static information pages. No web framework or Vercel function is needed: the browser requests the bounded public response from Supabase. This directory is still **local and unpublished**.

## Build

From the repository root, run `node script/build-sharing-web.mjs`. It generates the browser copy of the shared mobile/public response validator, the public endpoint module, and Vercel security headers. Do not hand-edit those three generated files.

By default the endpoint is blank and the page explains that sharing is unavailable. For a reviewed deployment, set `LEMONADE_SHARING_API_URL` to `https://<approved-project-ref>.supabase.co/functions/v1/shared-plan` before building. The build accepts only the exact HTTPS Supabase endpoint and restricts CSP to its origin. No keys or private values belong in this directory. No `.env.local` is loaded by this build.

Serve this directory as static output with its generated `vercel.json`; no additional hosted build is required after local generation. If automating deployment later, install root dependencies and run the same build from the repository root before publishing `web/`. Do not assume a Vercel environment variable edits a pre-generated JavaScript file automatically.

The local `script/serve-sharing-fixture.mjs` server is **test-only**. It serves synthetic content and substitutes a loopback endpoint in memory; its configuration and fixture API are never part of the publish directory. Start it from the repository root and open the synthetic link ending `/s#` plus 43 `A` characters. It binds only to 127.0.0.1:4179 and prints no requests, tokens or content.

## Boundaries

- Static deletion/privacy/terms/help pages do not collect data or run scripts.
- The recipient uses only same-origin code/font assets, a single public API, validated Google Maps destinations and text-node rendering. No auth, SDK, analytics, telemetry, cookies, browser storage, service worker or periodic polling.
- The fragment stays in the address bar so refreshing/copying works. It is not sent in the page request. Browser history/sync, extensions and services where users paste it can still retain it.
- All shell/data responses must be no-store. The page clears displayed content before a refresh, on hiding/leaving, and refetches on returning or BFCache restoration. Already delivered copies cannot be retracted.
- Native opening is opt-in for a verified compatible build; the default browser remains independent of the app. There are no invented app-store URLs.
- Barlow Condensed is self-hosted from the existing app font dependency; its license is in `fonts/OFL.txt`.

See `docs/release-0.9-public-web.md` for evidence, current hosting findings and remaining release gates. Do not deploy or change DNS without the owner's authorization.

Package F adds an optional explicit Open in Lemonade action. Set `LEMONADE_NATIVE_SHARING_SCHEME=project-lemonade` alongside the approved API endpoint only after verifying a compatible native binary; default output keeps the action off. No app installation is required for the browser page, and a failed native opening preserves it. Association generation and device acceptance are documented in docs/release-0.9-recipient-links.md.

## Initial Vercel project

Use project name lemonade, framework Other, and root directory web. The generated configuration skips installation/build and serves the prepared directory. Leave environment variables empty for the initial disabled site. The generator must run locally before future commits; changing a Vercel environment variable alone does not regenerate files. README.md and DESIGN.md are excluded from uploads by .vercelignore.

The planned custom origin is https://share.makeitlemonade.app. DNS has not been changed. Privacy text remains a draft pending the hosted logging review; pushing these files does not mark the 0.9 release approved or sharing enabled.
