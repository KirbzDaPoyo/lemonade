# Release 0.2-B Design Brief

## Scope

Replace Project Lemonade's incumbent visual identity across the existing native iOS and Android flows without changing product behavior or introducing future-release navigation and features.

## Approved Direction

**Synthetic Editorial** — user-approved concept C.

LEMONADE is the primary visual register; ACID is a secondary influence. The system should feel authored, kinetic, glossy, and album-adjacent while remaining quick to scan and familiar to operate as a native mobile app.

### Canonical V2 Artifacts

- `comps/v2-original-dark.png`
- `comps/v2-original-light.png`

These original V2 boards are the canonical implementation target. They were restored after user review and broader preference testing found them substantially more distinctive and visually appealing than the later V3 and V3.1 explorations. V3 and V3.1 remain comparison artifacts only; they are not approved fallback directions and must not be used to simplify V2's composition.

## Visual Contract

- Dark-first, with a coherent cool-white light mode and a persisted System / Light / Dark setting.
- Near-black and cool-white fields with electric chartreuse as the signature action color.
- Chartreuse leads, while cobalt, violet, and hot pink remain visibly present as structural and semantic signals; no decorative rainbow treatment.
- Barlow Condensed Bold for display moments; platform sans for body and controls; monospace only for account/data identifiers.
- Sharp geometry: 0–8px radii, one-pixel technical rules, compact controls, and asymmetric editorial composition.
- Minimal authored motion: brief scale/opacity press feedback that honors reduced motion.
- Diagonal energy fragments, offset planes, synthetic glyphs, warning-label details, and bounded glossy material form a recurring compositional signature. They may frame routine content when they preserve legibility; they must not collapse into generic decoration or identical treatment on every module.
- Screens should have distinct silhouettes and module rhythms. Do not reduce the system to one repeated stack of full-width panels, even when doing so would be easier to implement.

## Product and Interaction Constraints

- Preserve sign-up/sign-in, Instagram import, manual recovery, candidate matching, save, browse, filters, status, favorites, notes, tags, external links, deletion confirmations, and sign-out.
- Do not add tabs, maps as destinations, place photography, testimonials, commercial claims, or later-release features.
- Maintain safe areas, platform back behavior, 44pt iOS / 48dp Android touch targets, dynamic text resilience, narrow-screen readability, semantic accessibility roles, and non-color state labels.

## Anti-References

- Ubiquitous rounded cards or pills.
- Generic gradients, decorative glassmorphism, glow around every interactive element, or faux technical grids.
- Repeated eyebrow labels above every heading.
- Invented imagery or album artwork shipped as product content.
- A theme that is merely inverted rather than intentionally resolved for each appearance.

## Review Targets

- Auth: sign-up email step, verification step, validation error, light and dark.
- Home: populated, loading, empty/filtered-empty, open status selector, tags, light and dark.
- Add Place: default, manual-recovery prompt, loading.
- Candidate Match: populated, empty, saving-disabled state.
- Place Detail: status, favorite, details, tag management, notes, source, destructive action.
- Account: identity, appearance selection, sign-out error.

## Approved References

The user supplied eight concept images under `C:\Users\mikel\OneDrive\Documents\Lemonade concept photos\`. The exact approved implementation references are the restored original V2 dark and light boards under `comps/`. These references guide the visual system but are not application content.
