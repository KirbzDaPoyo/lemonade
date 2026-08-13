# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

People who discover places through public Instagram posts and reels, then want a private, dependable way to save, organize, and revisit those places on their phone.

## Product Purpose

Project Lemonade turns an Instagram URL into a structured saved-place record. Success means a user can quickly identify the correct place, save it to their own account, and later find it by status or personal tags.

## Positioning

The product is not a generic bookmark collection: it converts social discovery into a private place library with candidate matching, status, favorites, notes, maps, and user-owned tags.

## Operating Context

- Native iOS and Android app built with Expo and React Native.
- Places enter through pasted Instagram URLs or the mobile share sheet.
- Users confirm a candidate before it is saved.
- The saved library is browsed, filtered, and maintained from mobile screens.

## Capabilities and Constraints

- Preserve the existing authentication, import, candidate matching, saved-place, filtering, status, favorite, notes, tags, external-link, and sign-out behavior.
- Saved places and tags are scoped to the authenticated account.
- Release 0.2 work proceeds in sequential work packages; this redesign is Work Package 0.2-B and must not introduce later-release navigation or features.
- Expo Router is planned for a later work package and is not part of this visual refactor.
- Light, dark, and system appearance are first-class settings.

## Brand Commitments

- Product name: Project Lemonade; codename and visual reference: aespa's *LEMONADE* album.
- Approved visual direction: **Synthetic Editorial** (concept C), with LEMONADE as the primary register and ACID as a secondary influence.
- Canonical execution: the original V2 dark/light boards in `.design/release-0.2-b/comps/`. V3 and V3.1 are rejected comparison explorations, not implementation references.
- The user has final approval over visual decisions.
- The interface must balance a distinctive album-adjacent identity with fast, sleek navigation.
- Avoid a generic AI-generated or "vibe-coded" appearance.

## Evidence on Hand

- Existing working app flows and product copy in `src/`.
- Release assessment and architecture decisions in `docs/release-0.2-foundation.md`.
- Eight user-supplied visual reference images outside the repository under `C:\Users\mikel\OneDrive\Documents\Lemonade concept photos\`.
- The restored original V2 boards are the approved visual implementation references. They are design evidence, not product content, and must not be presented inside the app.
- The product has no supplied place photography, customer claims, testimonials, benchmarks, or commercial proof; future work must not fabricate them.

## Product Principles

1. Turn social discovery into useful place data with minimal friction.
2. Keep the user's library private, legible, and easy to maintain.
3. Make matching and recovery states explicit when extraction is uncertain.
4. Let the visual identity feel authored without obscuring familiar native tasks.
5. Preserve user control over saved data, tags, status, and appearance.

## Accessibility & Inclusion

- Preserve native safe areas and platform back behavior.
- Support dynamic text, narrow screens, 44pt iOS / 48dp Android touch targets, sufficient contrast, and reduced-motion preferences.
- Do not rely on color alone to communicate state.
