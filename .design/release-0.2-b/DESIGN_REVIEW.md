# Design Review: Release 0.2-B Synthetic Editorial

Reviewed against: `.design/release-0.2-b/DESIGN_BRIEF.md`  
Philosophy: Synthetic Editorial — LEMONADE primary, ACID secondary  
Date: 2026-08-12  
Disposition: **REBUILD THE COMPOSITION; KEEP THE FOUNDATION**

## Direction Update — Original V2 Restored

After reviewing V3 and V3.1 with several people, the user restored the original V2 direction as the canonical target. The later boards improved restraint and conventional hierarchy but removed too much of V2's authored identity. All fixes below must therefore be applied within V2's visual language rather than by simplifying it into the V3 composition.

Canonical references:

- `comps/v2-original-dark.png`
- `comps/v2-original-light.png`

## Screenshots Captured

All captures are from the native Android preview build 10 on one phone and were forwarded through WhatsApp at 1040×2048. They are stored locally under `.design/release-0.2-b/screenshots/` and ignored by Git because the Account captures contain private account data.

| Screenshot | Mode | Description |
| --- | --- | --- |
| `screenshots/home-light-phone.jpeg` | Light | Populated Home, filters, first saved rows |
| `screenshots/home-dark-phone.jpeg` | Dark | Populated Home, filters, first saved rows |
| `screenshots/add-place-light-phone.jpeg` | Light | Empty Add Place form |
| `screenshots/add-place-dark-phone.jpeg` | Dark | Empty Add Place form |
| `screenshots/place-detail-light-upper-phone.jpeg` | Light | Place header, status, favorite, details |
| `screenshots/place-detail-light-lower-phone.jpeg` | Light | Tags, notes, source, deletion |
| `screenshots/place-detail-dark-upper-phone.jpeg` | Dark | Place header, status, favorite, details |
| `screenshots/place-detail-dark-lower-phone.jpeg` | Dark | Tags, notes, source, deletion |
| `screenshots/account-light-phone.jpeg` | Light | Identity and appearance settings |
| `screenshots/account-dark-phone.jpeg` | Dark | Identity and appearance settings |

Not captured: Auth, Candidate Match, loading/error/empty states, open status menu, large font scale, tablet, or iOS. Those remain unverified.

## Summary

The build successfully establishes a coherent token foundation: Barlow Condensed loads correctly, the chartreuse/black/cool-white palette is recognizable, both appearances are intentional, and the UI is generally legible. However, the approved visual world was reduced to typography and accent color. The actual composition is a conventional vertical utility form made of repeated full-width panels, buttons, outlines, and chip grids. It does not yet carry the glossy, spatial, synthetic editorial identity shown in the approved direction boards.

This is not a micro-polish problem. The right next pass is a screen-composition rebuild that retains theme infrastructure and behavior while replacing the container and information architecture.

## Must Fix

1. **Rebuild the visual-world composition.** Home, Add Place, Place Detail, and Account all use the same stacked full-width panel grammar (`AccountScreen.tsx:80`, `AddPlaceScreen.tsx:129`, `PlaceDetailScreen.tsx:245`). Across every screenshot, the world reads as “condensed font plus lime” rather than Synthetic Editorial. _Fix: establish one signature spatial system—layered editorial fields, deliberate asymmetry, cropped/anchored metadata, and a single controlled synthetic energy treatment—then derive every screen from it._

2. **Restore task hierarchy on Home.** The wrapped tag matrix consumes most of the first viewport, pushing saved places below the controls in both `home-light-phone.jpeg` and `home-dark-phone.jpeg`. `HomeScreen.tsx:55` renders the entire catalog as primary UI. _Fix: show active filters and a short recent-tag rail; move the complete tag catalog to a native sheet or expandable filter surface so the saved-place index leads._

3. **Replace Place Detail's settings-stack architecture.** Status, Favorite, Details, Tags, Notes, and Source each become large independent panels. The repeated boxes create excessive scroll and flatten the importance of place identity in all four detail captures. _Fix: compose status/favorite as a compact control band, keep key facts in the hero field, and use dividers/typographic zones rather than six equally weighted containers._

4. **Meet Android touch and field-label accessibility requirements.** Compact buttons are hardcoded to 44px at `AppButton.tsx:49`, below the brief's 48dp Android minimum. `AppTextField` renders a visual label but does not default the native `accessibilityLabel` to that label (`app-text-field.tsx:22-31`). _Fix: make compact controls platform-aware with a 48dp Android floor and pass `accessibilityLabel={providedLabel ?? label}` to the input._

5. **Design disabled and semantic states instead of applying blanket opacity.** Disabled chartreuse buttons become muddy olive with low-emphasis labels in Add Place and Notes (`AppButton.tsx:54`). Favorite is named in pink but its active action becomes chartreuse (`PlaceDetailScreen.tsx:191-192`), weakening color meaning. _Fix: add explicit disabled surface/on-surface tokens, keep labels readable, and give Favorite a consistent pink active treatment plus a non-color selected indicator._

## Should Fix

1. **Reduce oversized control chrome.** Vertical appearance buttons, full-width Favorite, tall source buttons, and large inputs make the app feel like a web form. Account's three-option appearance setting (`AccountScreen.tsx:55-67`) should be a compact native segmented/radio pattern with selected state conveyed separately from button copy.

2. **Remove the decorative card rail.** The 3px chartreuse rail on every saved row (`PlaceCardRow.tsx:20`, `PlaceCardRow.tsx:56`) becomes a repeated costume motif and conflicts with the one-pixel technical language. Use indexing, alignment, or one selected/featured treatment instead of marking every row identically.

3. **Make navigation structurally consistent.** Place Detail pairs a text Back action with a large outlined Home button, while other screens center a title between an invisible spacer. The captures read as assembled controls rather than one native navigation model. Define one compact header pattern and preserve system Back behavior.

4. **Tighten information density and body scale.** Large panel padding and generous gaps create unfinished empty areas, most visibly on both Add Place captures. Use quiet space intentionally around a signature intake moment, not as leftover space below a conventional form.

5. **Consolidate motion infrastructure.** Reduced-motion handling exists both in `design-system/theme.tsx:221-236` and `design-system/use-reduced-motion.ts:1-37`, while only the latter is used. Keep a single source and add one purposeful transition for import/match progress rather than limiting motion to button scale.

6. **Finish responsive evidence.** The app declares tablet support, but this review has only one phone class. Capture Android phone at 1.3 font scale and a tablet before accepting the design-system work package.

## Could Improve

1. Move the raw Account ID behind an Advanced/Copy affordance. It is legitimate data, but its current prominence adds technical noise and exposes a private identifier in routine screenshots.
2. Introduce sparse cobalt/violet structure beyond the blue “OPEN” label and source URL; these colors were approved as secondary signals but currently feel incidental.
3. Give the loading/import sequence the approved glossy energy-streak material, contained to that moment and removed when content resolves.
4. Replace text-only selected labels such as “Light / Selected” with native accessibility state plus a concise visual marker.

## What Works Well

- Barlow Condensed is loading correctly and gives the headings a clear, recognizable voice.
- Light and dark modes are both intentional; dark mode is not a mechanical inversion.
- Chartreuse, pink, cobalt, and neutral roles are consistent enough to form a usable token base.
- Place names and primary actions are easy to locate, and body copy remains legible.
- The implementation avoided fabricated place imagery and preserved real product content and behavior.
- Sharp radii and technical dividers are directionally appropriate; the next pass should build on them rather than discard the foundation.

## Recommended Next Pass

Keep the adaptive theme, font loading, appearance persistence, semantic color roles, and application logic. Rebuild one representative vertical slice first—**Home populated → Add Place → Candidate Match → Place Detail hero/status**—against the original V2 boards. Preserve V2's asymmetry, diagonal energy language, varied modules, and stronger color identity while correcting touch targets, dynamic-text behavior, filter dominance, and semantic states. Do not migrate the remaining sections until those four viewports visually match V2. Then re-run this review with phone light/dark, 1.3 font scale, and tablet evidence.

---

# Build 11 Follow-up: Original V2 Vertical Slice

Reviewed against: `.design/release-0.2-b/DESIGN_BRIEF.md`  
Philosophy: Synthetic Editorial — original V2 canonical boards  
Date: 2026-08-12  
Disposition: **KEEP V2; REPAIR THE INTERACTION ARCHITECTURE**

## Screenshots Captured

These 19 user-supplied captures came from the physical Android preview build 11 and were archived under `screenshots/build-11/`. The Account captures contain private data, so all JPEG evidence remains ignored by Git.

| Screenshot | Mode | State |
| --- | --- | --- |
| `screenshots/build-11/home-light-filtered-bar.jpeg` | Light | Home filtered to one Bar result |
| `screenshots/build-11/add-dark-empty.jpeg` | Dark | Add Place empty/disabled |
| `screenshots/build-11/home-dark-status-open.jpeg` | Dark | Home status selector expanded |
| `screenshots/build-11/home-light-status-open.jpeg` | Light | Home status selector expanded |
| `screenshots/build-11/home-dark-filtered-bar.jpeg` | Dark | Home filtered to one Bar result |
| `screenshots/build-11/home-dark-list.jpeg` | Dark | Home populated list |
| `screenshots/build-11/add-dark-url-ready.jpeg` | Dark | Add Place URL entered |
| `screenshots/build-11/match-dark.jpeg` | Dark | Candidate Match populated |
| `screenshots/build-11/home-light-list.jpeg` | Light | Home populated list |
| `screenshots/build-11/add-light-url-ready.jpeg` | Light | Add Place URL entered |
| `screenshots/build-11/detail-dark-upper.jpeg` | Dark | Place Detail upper controls |
| `screenshots/build-11/account-dark.jpeg` | Dark | Account identity/appearance |
| `screenshots/build-11/detail-dark-lower.jpeg` | Dark | Place Detail details/tags/delete |
| `screenshots/build-11/add-light-empty.jpeg` | Light | Add Place empty/disabled |
| `screenshots/build-11/add-light-loading.jpeg` | Light | Add Place importing |
| `screenshots/build-11/match-light.jpeg` | Light | Candidate Match populated |
| `screenshots/build-11/detail-light-upper.jpeg` | Light | Place Detail upper controls |
| `screenshots/build-11/detail-light-lower.jpeg` | Light | Place Detail details/tags/delete |
| `screenshots/build-11/account-light.jpeg` | Light | Account identity/appearance |

Not captured: Auth, import errors/manual recovery, Candidate Match empty/saving, filtered-empty Home, dynamic type at 1.3, tablet, iOS, or gesture recordings.

## Summary

Build 11 validates the decision to restore original V2. Home and Candidate Match now have a recognizable authored identity: condensed editorial type, asymmetric acid action fields, synthetic glyphs, technical rules, and visible violet/cobalt/pink semantics. Dark mode is especially successful.

The next pass must not redesign the visual world. It must make V2 behave like a trustworthy native product. Android system Back and bottom insets are missing, light-mode acid foregrounds fail contrast, Candidate Match disguises an immediate save as a small Select control, and filtering/tag management expose too many options at once. Account and the lower Detail screen also remain visibly tied to the rejected generic foundation.

## Must Fix

1. **Honor Android Back and navigation-bar insets.** `AppNavigator.tsx:14,69-77` maintains a private stack without a BackHandler/native navigation listener. `App.tsx:51` explicitly omits the bottom safe-area edge. The system navigation bar visibly covers content in the long Home, Detail, and Account captures. _Fix: wire system/predictive Back to the current route and transient open states, then derive scroll bottom padding from the actual navigation-bar inset._

2. **Split acid fill from acid foreground in light mode.** Light `primary` (`#B7F500`) is only about 1.20:1 against the cool-white background; `primaryPressed` is about 1.61:1. Wordmarks, section labels, indexes, tag outlines, ratings, and progress indicators disappear in every light capture. Dark primary contrast is about 17.12:1. _Fix: retain bright chartreuse for fills, but introduce a darker readable acid-ink/border role for light surfaces and verify text plus non-text contrast._

3. **Make candidate selection deliberate.** `v2-candidate-match-screen.tsx:98-124` makes the whole card a Pressable while the visible Select box is only a View. Any tap immediately saves and navigates, with no selected-but-not-saved state. _Fix: make the visible Select control the target, or require selection followed by a sticky explicit Save action; keep progress/error feedback adjacent to the chosen result._

4. **Rebuild filter disclosure without losing V2 styling.** The five-row inline status menu pushes the saved library out of the viewport, and the horizontal tag rail clips `CAFÉ` without a scroll affordance. Tag targets are 40dp at `v2-filter-rack.tsx:111`, below the 48dp Android requirement. _Fix: use a compact anchored native surface or sheet, expose active filters and Clear, keep the library visible, and raise all tag targets to 48dp._

5. **Untangle Detail's user model and management UI.** Favorite is presented as a status on Home but a separate property on Detail. `v2-place-detail-screen.tsx:219-268` shows compact tags and then the complete legacy `UserTagsEditor`, raw provider data, full notes/actions, and Delete in one primary scroll. The favorite tile also draws a pink active mark on a pink background. _Fix: keep Favorite independent, correct its visible checked mark, move technical identifiers behind disclosure, and move full tag management to an explicit sheet/mode._

## Should Fix

1. Give Add Place a truthful three-state console: empty guidance, URL ready, and importing. The current non-loading copy always says `READY TO IMPORT` / `Paste a public post or reel to begin` even when a URL is present (`v2-add-place-screen.tsx:140-141`).
2. Do not label the first candidate `BEST MATCH` solely because `index === 0` (`v2-candidate-match-screen.tsx:96,114`) unless the service provides a defensible confidence signal; otherwise use `TOP RESULT`.
3. Add live announcements for result-count, loading, saving, and empty-state changes. The selected/expanded semantics are a good base, but the dynamic results are plain text.
4. Consolidate `AppButton`, `V2Button`, bespoke Home controls, and local tag buttons. Their drift already produced inconsistent targets and states.
5. Migrate Account to the V2 navigation and composition system. It is functional, but both Account captures still read as the earlier generic panel stack.
6. Test 1.3 font scale. Fixed display sizes plus `adjustsFontSizeToFit` currently shrink or truncate long place names instead of letting the editorial layout adapt.

## Could Improve

1. Show `+N` when a saved row or Detail summary hides additional tags.
2. Give filtered-empty Home a one-tap Clear Filters action.
3. End a successful save with a brief, explicit confirmation before presenting maintenance controls.
4. Keep status text and diamond color semantically aligned; visited currently keeps violet text beside a cobalt marker.
5. Preserve the V2 identity while giving Add, Match, Detail, and Account more distinct silhouettes instead of repeated bordered modules.

## What Works Well

- Original V2 is clearly the correct visual direction. The Home list is authored, compact, and recognizable rather than category-interchangeable.
- Dark mode carries the palette, hierarchy, and album-adjacent energy convincingly without becoming decorative noise.
- Add Place, Match, and upper Detail each establish one clear headline and primary task.
- Shared controls include useful reduced-motion handling, labels, roles, selected/disabled states, recovery prompts, and destructive confirmations.
- The implementation preserved real content and behavior without adding fabricated imagery or later-release features.

## Next Pass

Keep the V2 palette, typography, glyph system, indexing, and sharp technical geometry. Fix the native contract first (Back, insets, touch targets, contrast), then correct the decision surfaces (filter disclosure, candidate selection, truthful import status), then integrate Detail and Account into the same product-specific system. This is a refinement pass, not a V4 redesign.


---

# Build 13 Follow-up: Interaction Repair Validation

Reviewed against: `.design/release-0.2-b/DESIGN_BRIEF.md`  
Philosophy: Synthetic Editorial - original V2 canonical direction  
Date: 2026-08-12  
Disposition: **KEEP V2; COMPLETE A SURGICAL RELIABILITY AND DENSITY PASS**

## Screenshots Captured

These 15 user-supplied physical Android captures were archived under `screenshots/build-13/`. The user separately confirmed that Android system Back now works on every page.

| Screenshot | Mode | State |
| --- | --- | --- |
| `screenshots/build-13/01-home-dark-storage-warning.jpg` | Dark | Home populated with JWT storage warning |
| `screenshots/build-13/02-home-light.jpg` | Light | Home populated |
| `screenshots/build-13/03-filter-menu-dark-active.jpg` | Dark | Anchored filter menu with active status and tag |
| `screenshots/build-13/04-add-dark-empty.jpg` | Dark | Add Place empty/disabled |
| `screenshots/build-13/05-add-dark-url-ready.jpg` | Dark | Add Place URL ready |
| `screenshots/build-13/06-add-dark-loading.jpg` | Dark | Add Place importing |
| `screenshots/build-13/07-candidates-dark-unselected.jpg` | Dark | Candidate Match before selection |
| `screenshots/build-13/08-candidates-dark-selected.jpg` | Dark | Candidate Match selected, not yet saved |
| `screenshots/build-13/09-detail-dark-default.jpg` | Dark | Place Detail default favorite state |
| `screenshots/build-13/10-detail-dark-favorite.jpg` | Dark | Place Detail active favorite state |
| `screenshots/build-13/11-detail-dark-tag-manager.jpg` | Dark | Place Detail tag management expanded |
| `screenshots/build-13/12-detail-dark-technical-bottom.jpg` | Dark | Place Detail technical disclosure and bottom inset |
| `screenshots/build-13/13-account-dark.jpg` | Dark | Account |
| `screenshots/build-13/14-account-light.jpg` | Light | Account |
| `screenshots/build-13/15-home-dark-bottom-safe-area.jpg` | Dark | Home list end and Android bottom inset |

Not captured: Auth, error/manual-recovery import, Candidate Match empty or saving, filtered-empty Home, filter menu in light mode, Place Detail in light mode, 1.3 font scale, tablet, iOS, or motion recordings.

## Summary

Build 13 validates the repair strategy. The app now preserves the authored V2 identity while behaving much more like a trustworthy native product. Android Back is confirmed, bottom content clears the system navigation bar, light-mode acid ink is readable, Add Place communicates its three states honestly, Candidate Match separates selection from persistence, filtering is disclosed through an anchored surface, and technical data is hidden until requested.

This is the strongest build so far and should remain the baseline. Two P1 defects remain: a Supabase clock-skew error is still exposed to the user, and the Candidate Match save dock obscures results. The remaining P2 work is predominantly density, icon legibility, and disclosure polish.

## Must Fix

1. **Handle the actual Supabase clock-skew response and recover without exposing backend text.** The dark Home capture shows `Supabase saved places tag read failed: JWT not yet valid`. The fetch wrapper only recognizes `/jwt issued at future/i` and retries once after a fixed one-second delay (`src/lib/supabaseClient.ts:40-65`), so the observed `JWT not yet valid` variant bypasses recovery. `PlacesProvider` also hydrates places and tags through one `Promise.all`, allowing a tag failure to mark the whole storage layer as failed (`src/store/PlacesContext.tsx:67-83`). _Fix: recognize both clock-skew messages, use a bounded fresh-token retry/backoff, load places and tags independently, and expose a concise retryable message only if recovery is exhausted._

2. **Make the Candidate Match dock reserve its real height plus the safe-area inset.** In both candidate captures, the absolute save dock covers the lower candidate card and its Select action. The list reserves a hard-coded `132` pixels while the dock has dynamic copy, padding, and a 48dp control (`src/screens/v2-candidate-match-screen.tsx:137,155-159`). _Fix: measure the dock or derive a shared height, add the bottom safe-area inset, and use that value as list footer/padding so every candidate and action can scroll fully above it._

## Should Fix

1. **Redraw the favorite mark.** The selected state contract is now excellent, but the custom three-piece heart reads as a paddle/blob when filled and as an orbital knot when inactive (`src/components/v2-marks.tsx:49-80`). Use one unmistakable authored heart silhouette and keep the strong pink container/outline treatment.

2. **Preserve complete decision-critical addresses.** The selected place detail clamps the imported multilingual address to two lines (`src/screens/v2-place-detail-screen.tsx:194-197`), producing an ellipsis before the user can verify the location. Allow expansion or an additional line; do not silently hide the differentiating part of an address.

3. **Tighten the anchored filter surface.** Moving filters out of the document flow is a clear improvement, and active state plus Reset are readable. At the current `maxHeight: 430`, however, the surface occupies nearly half the phone and visually collides with the separate Clear control (`src/components/v2-filter-rack.tsx:94-149,185-203`). Anchor to the full trigger row/screen bounds, reduce vertical chrome, and keep the tag area internally scrollable.

4. **Make Appearance one compact control.** Account now belongs to V2, and technical identity is properly disclosed. The three full-width stacked buttons still consume too much space for one mutually exclusive setting (`src/screens/AccountScreen.tsx:60-78,102-103`). Use a single segmented/radio row while preserving selected accessibility state and the short descriptive line.

5. **Keep tag management explicit without expanding the main Detail page into an admin form.** The Manage affordance is a successful disclosure, but its expanded state inserts the entire shared catalog and creation UI before Notes (`src/screens/v2-place-detail-screen.tsx:242-270`). Move the expanded manager to a bounded sheet or dedicated management mode, then return to the compact assigned-tag rail.

## Could Improve

1. Refine the tiny loading spinner in Add Place so it reads as a deliberate progress mark rather than a clipped arc.
2. Add light-mode evidence for filtering, Candidate Match, and Place Detail before final visual acceptance.
3. Test long names and addresses at 1.3 font scale; the current condensed headings handle ordinary content well but the two-line title/address limits remain brittle.
4. Keep the raw provider error available to diagnostics, but never make it the primary user-facing banner copy.

## What Works Well

- Candidate selection now matches the approved mental model: Select creates a reversible local choice, Selected is unmistakable, and Save Place is a separate explicit commit.
- Android Back is confirmed across pages, and the long Home/Detail captures show clean clearance above the system navigation bar.
- Light mode is now legible without losing chartreuse as the signature fill; darker acid ink and borders preserve the identity.
- The compact Home header, indexed place rows, asymmetric Add action, synthetic place glyphs, and controlled pink/violet/cobalt signals still make the product recognizable as Lemonade.
- Add Place truthfully distinguishes empty, URL-ready, and importing states.
- `TOP RESULT` avoids making an unsupported confidence claim.
- Technical IDs and the source URL are now behind explicit disclosure, and Account is structurally integrated with V2.
- Disabled, selected, error, and destructive states are much clearer than in Build 11.

## Next Pass

Do not redesign the shell. First fix the JWT recovery path and Candidate Match dock geometry. Then repair the favorite symbol, address disclosure, filter density, Account appearance control, and tag-management container. Rebuild once, then capture only the affected states plus light-mode Match/Detail and 1.3 font scale. If those pass, the V2 visual foundation is ready to freeze and the project can move from identity work to broader product UX.
