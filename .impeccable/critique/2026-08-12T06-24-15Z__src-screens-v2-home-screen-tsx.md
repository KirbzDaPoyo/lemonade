---
target: Build 11 V2 vertical slice
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
timestamp: 2026-08-12T06-24-15Z
slug: src-screens-v2-home-screen-tsx
---
Method: dual-agent (A: design_assessment · B: detector_assessment)

# Design Health Score

| # | Heuristic | Score | Key issue |
| --- | --- | ---: | --- |
| 1 | Visibility of System Status | 2 | Loading/pending labels exist, but Add says “READY TO IMPORT” in contradictory states and successful save lacks a clear arrival moment. |
| 2 | Match System / Real World | 3 | Place language is natural; raw IDs and Favorite-as-status leak the data model. |
| 3 | User Control and Freedom | 2 | Visible Back/Home and destructive confirmations exist, but Android system Back is not integrated and a candidate tap commits immediately. |
| 4 | Consistency and Standards | 2 | The V2 core is cohesive; Account, full tag management, and Favorite semantics still diverge. |
| 5 | Error Prevention | 2 | Destructive actions are guarded, but the whole candidate card is an immediate save target. |
| 6 | Recognition Rather Than Recall | 3 | Primary actions are visible; clipped tag overflow and icon-only navigation weaken discoverability. |
| 7 | Flexibility and Efficiency | 2 | Share-sheet import and filters help; there is no search, bulk management, or fast recovery path. |
| 8 | Aesthetic and Minimalist Design | 3 | Dark V2 is distinctive; technical metadata and always-open maintenance UI add noise. |
| 9 | Error Recovery | 2 | Several errors explain a next step, but recovery remains alert-heavy and sometimes detached from the failing control. |
| 10 | Help and Documentation | 2 | Inline hints exist; important concepts and interruption recovery remain unexplained. |
| **Total** |  | **23/40** | **Acceptable — strong identity, significant native/UX work remains.** |

# Design Specificity Verdict

**Strongly authored, but not consistently product-specific below the first viewport.** Home now feels unmistakably Project Lemonade: condensed editorial type, acid action fields, synthetic glyphs, technical indexing, and controlled violet/cobalt/pink semantics. Dark mode is the clearest success. Candidate Match becomes more conventional, Account still uses the old generic settings stack, and lower Detail becomes an administrative tag/database form.

The deterministic detector returned `[]` with zero single-file findings for `src/screens/v2-home-screen.tsx`. That is not a clean bill of health: its scope does not model native Back, window insets, cross-component drift, or screenshot contrast. Manual native evidence found those failures in exact source locations.

Browser overlays were not applicable: this is a physical native Android build with no verified live DOM URL. The 19 archived device captures under `.design/release-0.2-b/screenshots/build-11/` were the visual fallback evidence.

# Overall Impression

Restoring V2 was the right decision. This build has the identity V3 lost. The next move is not V4; it is to make V2 behave like a trustworthy native app and progressively disclose its maintenance features.

# What’s Working

- Home is authored, compact, and recognizably tied to the approved V2 boards.
- Dark mode carries the palette and hierarchy convincingly without becoming decorative noise.
- Add Place, Match, and upper Detail each establish one clear headline and task.
- Shared controls include reduced-motion handling, semantic roles/states, recovery prompts, and destructive confirmations.

# Cognitive Load

**Moderate: 3 of 8 checklist failures.** Chunking, minimal choices, and progressive disclosure fail. The open Home selector exposes five statuses while the tag rail remains visible; Detail exposes fifteen tag choices plus management, creation, technical metadata, actions, and deletion in one scroll.

# Emotional Journey

Home opens with confidence. Add Place narrows attention, but contradictory ready/disabled copy introduces doubt. Candidate Match restores momentum, then turns its highest-stakes decision into an accidental-tap risk. A successful save has no rewarding confirmation; users land directly in maintenance controls and database details, so the journey ends administratively.

# Priority Issues

## [P1] Native navigation contract is broken

**Why it matters:** `AppNavigator.tsx:14,69-77` owns a JS stack without Android Back integration, while `App.tsx:51` omits the bottom safe-area edge. The system navigation bar visibly covers long content, and hardware/predictive Back can bypass the intended route history.

**Fix:** Wire system Back to transient states and the current stack, then derive every scroll surface’s bottom inset from the real navigation-bar inset.

**Suggested command:** `$impeccable adapt`

## [P1] Light-mode acid foregrounds are inaccessible

**Why it matters:** Light primary chartreuse is about 1.20:1 against the cool-white background and the darker variant only 1.61:1. Small labels, outlines, indexes, ratings, glyphs, and progress indicators disappear. Dark primary is about 17.12:1, confirming a role problem rather than a palette problem.

**Fix:** Keep bright chartreuse as fill/material; add a darker light-theme acid ink/border role for on-surface text, icons, and rules.

**Suggested command:** `$impeccable colorize`

## [P1] Candidate cards disguise an immediate save

**Why it matters:** `v2-candidate-match-screen.tsx:98-124` makes the whole card a Pressable while the apparent Select control is a non-interactive View. A tap while inspecting or scrolling can save the wrong place with no selected-but-not-saved state.

**Fix:** Make the visible Select button the target, or select first and expose a sticky explicit “Save [place]” action with adjacent progress/error feedback.

**Suggested command:** `$impeccable harden`

## [P1] Filtering overwhelms the library

**Why it matters:** The five-row inline status menu pushes saved places out of view. The horizontal tag rail clips its last item with no affordance, and its 40dp controls miss the Android 48dp floor.

**Fix:** Move complete filtering into a compact native sheet/anchored surface, keep active filters and Clear visible, preserve the library viewport, and make all targets 48dp.

**Suggested command:** `$impeccable layout`

## [P2] Detail and Account leak the implementation model

**Why it matters:** Favorite is both a pseudo-status and an independent property; its pink mark is invisible on its pink Detail tile. Detail duplicates compact tags with the full legacy tag editor and exposes raw provider data. Account exposes raw account data and remains on the old component grammar.

**Fix:** Keep Favorite independent with a visible checked mark, move technical data behind disclosure, move tag management into an explicit mode/sheet, and migrate Account to V2 primitives.

**Suggested command:** `$impeccable distill`

# Before / After Interaction Contract

| Before | After | Why |
| --- | --- | --- |
| Android Back only works through custom top buttons | System/predictive Back pops transient UI and the route stack | Native muscle memory must never be trapped or bypassed. |
| Fixed bottom padding while the root omits the bottom inset | Real navigation-bar inset applied to each scroll surface | Content must never sit under system controls. |
| Chartreuse used as both bright fill and light-theme foreground | Bright acid fill plus darker accessible acid ink | Preserves the palette while restoring legibility. |
| Whole candidate card saves immediately | Explicit Select, then visible saving/confirmation | A high-stakes choice must be deliberate. |
| Five inline status rows plus a clipped tag rail | Compact filter surface with active summary and Clear | Progressive disclosure keeps the library primary. |
| Tags, raw IDs, actions, and deletion in one long Detail scroll | Compact Detail plus explicit management/technical disclosure | Routine revisiting should not feel like database administration. |

# Persona Red Flags

**Jordan, first-time user:** Empty Add says “READY TO IMPORT” while Find is disabled; Favorite appears to replace status; the apparent Select control hides a whole-card commit; raw IDs suggest knowledge Jordan does not have.

**Casey, distracted mobile user:** important actions sit high; filter targets are undersized; system Back can leave the flow; an incidental card tap can save; interruption/draft reassurance is absent.

**Sam, accessibility-dependent user:** light acid foregrounds nearly disappear; fixed/shrink-to-fit type is fragile; result/loading changes are not announced; some controls miss 48dp. The existing labels, roles, selected/disabled states, and reduced-motion support are a good base.

# Minor Observations

- Add Place needs distinct empty, URL-ready, and importing console copy.
- `BEST MATCH` is assigned because `index === 0`; use `TOP RESULT` unless ranking confidence justifies the stronger claim.
- Result-count, loading, saving, and empty changes need live accessibility announcements.
- `AppButton`, `V2Button`, bespoke Home controls, and local tag buttons are drifting.
- Hidden extra tags need a `+N` indicator; filtered-empty Home needs one-tap Clear Filters.
- Visited uses a cobalt marker with violet text.
- Auth, error/manual recovery, dynamic type 1.3, tablet, iOS, and gesture recordings remain unverified.

# Questions to Consider

- Should the next implementation pass fix only the four P1 issues, or also migrate Detail/Account in the same pass?
- Should Candidate Match use direct Select-button saving, or a two-step selection plus sticky Save action?
- Should full filtering and tag management use native sheets, or dedicated in-flow V2 modes?
