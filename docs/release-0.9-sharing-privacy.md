# Release 0.9 — Package C: public content and privacy

Status: content boundary, preview/disclosure model, diagnostic hardening and policy drafts complete locally. The owner preview screen and enable confirmation are implemented in Package D, not delivered here. No deployment or hosted data changes.

## Reviewed content path

The approved content path remains independently owner-authored place names and optional location text. Legacy Google/Instagram-derived fields never prefill these inputs. A separate public title defaults to Places to try; the private title is not copied. Authorship is a deliberate assertion, not something software can independently verify.

The backend already projects only public title, ordered names, optional location and safe map destinations. Package C adds `src/services/sharing-content.ts`, a strict consumer boundary for the owner preview and recipient screens. It rejects unexpected keys at either level, missing fields, private saved-place rows, malformed values and oversize content. There is no fallback from a failed public response to private plan/place data.

Map destinations must exactly match the supported canonical Google Maps search URL constructed from the displayed name/location and optional validated provider Place ID. Extra/duplicate parameters, altered destinations, credentials, redirects, short links, fragments and alternative hosts/schemes are rejected. Null map destinations remain valid and must hide the map action.

`createSharingReview` returns validated content plus reusable disclosure copy. Tests confirm the owner preview and public handler yield identical content. Both future screens must use this parser; it is not yet wired to an app screen or a browser renderer.

## Owner preview and enable flow for Package D

1. Start with the neutral public title and blank independently authored fields. Existing public values may be loaded for deliberate editing; never substitute private/provider values.
2. Validate and save public inputs, then obtain a fresh server preview. Do not enable from an optimistic local preview after a failed save. Bind the action to the returned management revision and refresh on conflict.
3. Render exactly the validated public title and ordered list, including the optional locations/map actions. Use React Native Text or browser textContent/escaped text, never HTML interpolation. Script-like strings remain ordinary text; this package does not claim actual renderer/XSS verification.
4. Show the reusable disclosure before enabling. Explain that the private fields excluded automatically could still be disclosed if the owner types them into a public field.
5. Use the explicit action Enable read-only link. Keep pending/failed states honest and preserve editable input. Show success only after server confirmation.
6. If any member has no public name, do not enable. An existing active link becomes unavailable until the missing label is supplied. Do not silently omit that member. Empty plans can display a clear empty state.
7. Later membership/public-detail edits appear on subsequent retrieval; private title edits do not change the public title. Disable prevents future retrieval but does not retract open-page content or copies.

The disclosure in code covers:

- Exactly which title, names, optional locations, order and map links are visible.
- Anyone with the link can view/forward it without an account.
- Plan/public-detail changes affect the shared page.
- New unlabeled members temporarily make the page unavailable.
- Revocation cannot remove displayed content, screenshots or copies.
- Public fields must be independently authored and intentionally public.
- Private title, notes, journals, ratings, visit dates, tags, favorites, status, account details and Instagram sources are not automatically included.
- Opening an external map link sends its destination to Google Maps.

No auto-enable, collaboration, invitations, recipient editing, new provider request, photo/enrichment or public-view tracking is added.

## Provenance and attribution decision

The stored provider-field restrictions identified in A remain in force. Owner-authored labels are not represented as Google-authored content. Use a clear Open in Google Maps action for external destinations. The Place ID may be used in that URL; it is not an access credential or separately displayed internal identifier.

No stored Google name/address, rating, image or other enrichment is approved by this package. If a future change displays provider content, first establish applicable reuse permission and current branding/third-party attribution requirements. Do not assume an attribution label resolves permission. The source references and account-specific limitations are recorded in the Package A contract; no new provider exception is claimed here.

## Diagnostics

`src/observability/error-monitoring.ts` now scrubs production/development Lemonade scheme URLs, raw 43-character share tokens/keys, verifier hashes, encrypted-token strings and sharing/public-name/public-label contexts. This supplements existing URL, authorization and sensitive-field filtering. Matching opaque strings may be conservatively redacted even when unrelated to sharing; fixed operational labels remain usable.

Tests execute the actual scrubber on nested contexts, arrays and stack-frame strings. No raw request, token, content or public-view event is added to telemetry. These defenses do not establish that arbitrary content placed under an unrelated field can always be recognized: handlers/screens must continue using only fixed allowed telemetry values.

Provider-controlled request/response capture remains a separate hosted release gate. App scrubbing cannot promise that Supabase, Vercel or Cloudflare logs contain no sensitive data. Verify synthetic credentials, actual settings, access and retention before rollout. Fragment links keep credentials out of normal page-request URLs, but browsers, clipboard tools and chosen messaging services can retain them.

## Files changed in C

- `src/services/sharing-content.ts`: strict public-response parser and preview/disclosure model.
- `src/observability/error-monitoring.ts`: sharing-specific diagnostic redaction.
- `tests/sharing-content.test.ts`, `package.json`: five new behavior tests included in the full suite.
- `web/privacy.html`, `web/terms.html`: unpublished Release 0.9 drafts covering optional sharing, authorship, forwarding, live updates, deletion/revocation and infrastructure records.
- `web/index.html`: deletion scope includes sharing details/links when enabled.
- `web/README.md`: accurately describes the information drafts and distinguishes the future dynamic sharing page.
- This handoff. No migrations, dependencies, environment values or dashboard setup changed in C. Preserve the uncommitted A/B work.

The privacy draft continues to describe schema-5 export because schema-6 integration is not implemented yet. Update that copy alongside D's export changes. Existing visit/map/private account behavior is preserved.

## Verification and remaining checks

- Full suite: 182 tests passed after adding the five Package C tests.
- TypeScript: passed.
- Focused tests cover identical preview/public output, exhaustive unexpected private-field rejection, malicious destinations, Unicode/size/empty cases and actual diagnostic scrubbing.
- Existing privacy/deletion page and monitoring tests passed with the updated drafts.
- Whitespace/diff review passed.

No database migration or backend handler change was made, so B's database/Deno suites were not repeated. No device, native build or browser renderer acceptance is claimed. Validate actual inert text rendering, large text, accessibility, keyboard and themes when implementing D/E. The policy drafts were reviewed as source text, not as a deployed page.

No API key, domain action or purchase is needed from the owner for this package. There is no additional provider request or recurring service cost. The next package is D: owner controls, the actual preview/enable flow, copy/share/view/disable/regenerate, and export integration. Sharing remains disabled by default until all rollout gates are satisfied.
