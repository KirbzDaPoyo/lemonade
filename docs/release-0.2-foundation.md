# Release 0.2 engineering and design foundation

This record completes Work Package 0.2-A. It describes the repository baseline on
2026-08-11 and fixes the architecture boundaries for the remaining Release 0.2
work. It does not change application behavior or authorize later-release scope.

## Repository assessment

Status meanings:

- **Complete**: the work-package completion criteria are present and validated.
- **Partial**: useful foundations exist, but the work package is not complete.
- **Not started**: no material implementation for the work package is present.

| Work package | Status after 0.2-A | Repository evidence and remaining work |
| --- | --- | --- |
| 0.2-A Baseline and architecture decisions | **Complete** | The baseline and decisions are recorded in this document. No runtime dependencies or paid resources were added. |
| 0.2-B Design system | **Partial** | `src/theme.ts` has one fixed color palette plus spacing and radii, and shared components such as `AppButton`, `ScreenHeader`, and `StorageErrorBanner` exist. `app.json` forces `userInterfaceStyle` to `light`; there is no appearance preference, dark palette, typography scale, border/elevation tokens, theme provider, or complete set of reusable states and controls. Screens still own substantial styling and a few hardcoded colors. |
| 0.2-C Navigation foundation | **Not started** | `src/navigation/AppNavigator.tsx` owns an in-memory `AppRoute[]` stack and switches directly between screen components. Neither Expo Router nor React Navigation is installed. Native stack history, Android hardware-back integration, deep-link-ready routes, and protected-stack reset behavior are not implemented by a maintained navigator. |
| 0.2-D PostHog analytics | **Not started** | There is no PostHog dependency, analytics wrapper, event taxonomy implementation, user identification, or sign-out reset. |
| 0.2-E Sentry error monitoring | **Not started** | There is no Sentry dependency, error boundary, scrubber, release context, or unexpected-error capture policy. Current errors are handled locally or displayed to the user. |
| 0.2-F Data export and account deletion | **Not started** | `src/screens/AccountScreen.tsx` only shows account details and sign-out. The repositories are user-scoped, but there is no export serializer/share flow, deletion RPC, Clerk deletion flow, partial-failure state, or public deletion-information web surface. |
| 0.2-G CI, documentation, and release verification | **Partial** | `package.json` already exposes deterministic `test` and `typecheck` scripts, and `README.md` plus `.env.example` document the current alpha. There is no `.github/workflows` CI, Release 0.2 observability/privacy configuration documentation, public web project, or final device-verification record. |

The next implementation package is **0.2-B, Design system**. Work packages must
continue in the specified order after this assessment.

## Automated baseline

The following checks were run from a clean `master` worktree on 2026-08-11:

| Command | Result |
| --- | --- |
| `npm test` | Passed: 42 tests, 0 failures |
| `npm run typecheck` | Passed: `tsc --noEmit` returned no errors |
| `npx expo-doctor` | Passed: 18 of 18 checks |

The current tests cover domain mapping, lifecycle/favorite independence, tag
filtering and catalog behavior, Instagram URL/share parsing, user ownership and
RLS migration expectations, authenticated provider functions, and JWT clock-skew
retry behavior. They do not render screens or exercise native navigation, device
share sheets, appearance changes, analytics, Sentry, export, or account deletion.

## Current application boundaries

- `index.ts` registers `App.tsx` as the Expo root.
- `App.tsx` places `ShareIntentProvider` outside the safe-area and Clerk providers.
  Authentication gates the user before `PlacesProvider` and `AppNavigator` mount.
- `src/navigation/AppNavigator.tsx` consumes incoming shares only inside the
  authenticated application. A valid Instagram URL resets its local stack to Home
  then Add Place; an invalid share produces an alert.
- `src/store/PlacesContext.tsx` constructs a repository with the Clerk user ID and
  access-token provider. Supabase queries and RLS scope saved places and tags to the
  Clerk JWT subject.
- Provider secrets remain in Supabase Edge Functions. The mobile app receives only
  public Clerk and Supabase configuration.

These boundaries must remain intact through Release 0.2.

## Navigation decision

### Decision: Expo Router

Release 0.2-C should migrate the custom stack to Expo Router rather than wiring
React Navigation directly.

Repository evidence:

1. The app uses Expo SDK 54 and already has `expo-linking`, a custom
   `project-lemonade` scheme, and route-oriented future requirements.
2. Installed `expo-share-intent` 5.1.1 supports Expo SDK 54 and documents an Expo
   Router integration. Its provider can remain above the route tree in the root
   layout, preserving the current share-intent boundary.
3. Expo Router supplies the maintained native stack, Android back handling, URL
   routing, and route-group structure needed by later releases without adding a
   separate navigation abstraction.
4. Direct React Navigation would also work, but its documented share integration
   requires custom linking configuration and would leave the project responsible
   for more route/deep-link plumbing. No repository constraint makes that safer.

The migration should add the Expo-SDK-compatible Router packages with
`npx expo install`, set the supported Router entry point, and keep route files thin.
Reusable screens, providers, domain state, and services remain under `src/`; they
must not be moved wholesale into `app/`.

Proposed route shape for 0.2-C:

```text
app/
  _layout.tsx                 Root providers and authentication boundary
  (auth)/
    sign-in.tsx              Existing Clerk email-code surface
  (app)/
    _layout.tsx              Authenticated native Stack
    index.tsx                Saved places
    account.tsx              Account
    add-place.tsx            Manual or incoming-share entry
    match-place.tsx          Candidate confirmation
    place/[placeId].tsx      Place detail
```

Implementation constraints for the migration:

- `ShareIntentProvider` stays outside all other providers in the root layout, as
  required by `expo-share-intent`.
- A small authenticated share coordinator consumes and resets the share exactly
  once, stores the submitted URL in transient import state, resets the protected
  stack, and routes to Add Place. Source URLs, extracted captions, and candidate
  payloads must not be encoded in route parameters or analytics.
- Manual Add Place opens the same route with empty transient import state.
- Candidate data remains in a scoped in-memory import-flow provider. Only durable,
  non-sensitive identifiers such as `placeId` belong in route parameters.
- Signing out replaces the protected route group with the authentication route.
  Signing in starts at Home, so stale protected history cannot survive an identity
  transition.
- `router.back()` preserves existing Back actions. `router.replace('/')` or an
  equivalent stack reset preserves Reset to Home. The native Stack owns Android
  hardware-back behavior.
- Add focused tests for share normalization/coordinator decisions and route reset
  helpers. Native hardware back and cold/warm share delivery still require an
  Android development build.

This choice requires no hosted resource and no recurring cost.

## Theme and design-system structure

Work Package 0.2-B should evolve the current theme incrementally into this small
structure:

```text
src/theme/
  primitives.ts       Raw palette values and fixed spacing/radius scales
  semantic-colors.ts  Light and dark semantic color mappings
  typography.ts       Font size, line height, weight, and letter-spacing roles
  shadows.ts          Platform-safe elevation/shadow roles
  theme.ts            AppTheme type and light/dark theme objects
  theme-provider.tsx  system/light/dark preference and useAppTheme hook
```

Theme rules:

- Public components consume semantic roles such as `background`, `surface`,
  `surfaceRaised`, `text`, `textMuted`, `border`, `actionPrimary`,
  `actionDestructive`, `statusSuccess`, and `statusWarning`. Screens do not import
  raw palette values.
- Keep the existing spacing scale unless a demonstrated layout need requires an
  addition. Expand radii, typography, borders, and shadows only to support actual
  shared components.
- `app.json` changes from forced light appearance to system-controlled appearance.
  The provider resolves a stored `system | light | dark` preference against
  `useColorScheme`; the already-installed SecureStore can persist the small
  preference without adding a storage dependency.
- Status-bar style, navigation theme, screen background, and dialogs derive from
  the resolved theme.
- Shared components cover the variants and states required by 0.2-B. Existing
  screens are migrated incrementally without changing their product behavior.
- Controls retain at least 44 by 44 point touch targets, accessible labels/roles,
  visible disabled/focus states, dynamic text wrapping, and layouts that tolerate
  narrow screens and long content.
- Do not add a broad UI framework. React Native and the existing Expo packages are
  sufficient for this foundation.

## Analytics contract

Work Package 0.2-D should expose a central typed adapter, for example
`src/observability/analytics.ts`. Product code calls typed functions; the PostHog
SDK is an implementation detail. When configuration is missing or capture fails,
the adapter is a no-op and product behavior continues.

Common properties are limited to low-cardinality release context: `environment`
(`development`, `preview`, or `production`), `platform`, and app version/build.
Event-specific permitted properties are:

| Event | Permitted properties |
| --- | --- |
| `auth_completed` | `method: 'email_code'` |
| `share_received` | `provider: 'instagram'`, `platform` |
| `manual_add_opened` | none beyond common properties |
| `import_started` | `provider: 'apify'` |
| `import_succeeded` | `provider: 'apify'` |
| `import_failed` | `provider: 'apify'`, normalized `failure_category` |
| `candidates_displayed` | `provider: 'google_places'`, bounded `result_count` |
| `candidate_selected` | `provider: 'google_places'`, bounded `candidate_rank` |
| `place_saved` | `status` |
| `place_opened` | `status` |
| `map_link_opened` | `provider: 'google_maps'` |
| `place_status_changed` | `previous_status`, `status` |
| `favorite_changed` | `is_favorite` |
| `signed_out` | none beyond common properties |

Normalized failure categories should be a small enum such as `private_post`,
`unsupported_url`, `rate_limited`, `provider_unavailable`, `no_match`, `network`,
and `unexpected`. Never attach the raw error message or provider response.

After Clerk authentication, identify PostHog with the Clerk user ID only. Reset
identity before or as part of sign-out and account-deletion cleanup. Do not send
email, caption, notes, source URL, search text, address, place name, Clerk/Supabase
token, or arbitrary error data. Autocapture and session replay remain disabled.
Development and production events are distinguished by the common environment
property and separate environment configuration where practical.

Expected provider outcomes may produce a normalized PostHog funnel event, but are
not Sentry errors. No event in this contract adds a provider request or material
operating cost; PostHog usage must remain within the selected free allowance during
validation.

## Sentry boundary

Work Package 0.2-E should initialize Sentry in one adapter under
`src/observability/` and remain a no-op when no DSN is configured.

- Put a last-resort boundary around the application frame and narrower boundaries
  around the authenticated navigation surface and import flow. Each boundary shows
  an accessible retry/reset state.
- Capture unexpected failures from authentication transitions, navigation,
  persisted storage, import orchestration, and place search. Expected outcomes such
  as a private post, unsupported URL, provider rate limit, or zero candidates stay
  handled UI states unless the failure itself is technically unexpected.
- Attach app version, native build number, platform, EAS release channel, and
  `development | preview | production` environment. Use stable operation/category
  tags rather than content-bearing context.
- A `beforeSend` scrubber must remove email-like fields, authorization headers,
  tokens, cookies, captions, notes, source URLs, query text, provider request or
  response bodies, and user-entered place data. Do not set email or source URL as
  user/context fields. If user correlation is enabled, use only the Clerk user ID.
- Performance tracing and profiling remain disabled until a sampling rate is
  explicitly chosen. Monitoring failure never blocks a user action.
- A development-only controlled exception may verify setup; it must not be
  reachable in production UI.

PostHog records expected product funnel outcomes. Sentry records unexpected
technical failures. The same handled error must not be sent indiscriminately to
both systems.

## Export and account-deletion architecture

### Data export

Work Package 0.2-F should query through the authenticated, RLS-scoped repository
and serialize the returned places and tag catalog on-device. The primary artifact
is versioned UTF-8 JSON containing the current user's saved-place fields, user tags,
notes, status, favorite flag, timestamps, source reference, map reference, and
provider place ID. A flattened CSV may be offered as a convenience, but JSON is the
complete portable format.

Use Expo file-system and sharing APIs compatible with SDK 54 to write to the app
cache and open the native share sheet. Explain that the user chooses the final
destination and remove or overwrite temporary export files on the next export.
The export must not contact Apify or Google Places and must never query outside the
current Clerk subject.

### Account deletion

Use a two-system, authenticated sequence with explicit partial-failure reporting:

1. Require deliberate typed or two-step confirmation and display exactly which
   Lemonade data and Clerk identity will be removed.
2. Obtain a fresh token for the current Clerk session. Abort if the session cannot
   be validated.
3. Call an additive Supabase `delete_current_user_data()` RPC as the authenticated
   user. The function runs transactionally, derives its subject only from
   `auth.jwt()->>'sub'`, deletes only matching rows from all current user-owned
   tables, and returns non-sensitive deletion counts. Revoke it from `public` and
   `anon`; grant execute only to `authenticated`. RLS and explicit subject
   predicates remain defense in depth. Do not accept a user ID argument.
4. After backend deletion succeeds, call Clerk's authenticated current-user
   deletion method. Do not expose a Supabase service-role key or Clerk secret to
   the app and do not create a generic service-role deletion endpoint.
5. Only after both systems confirm success, reset PostHog/Sentry identity, clear
   local user state, and sign out. Report success once.

If Supabase deletion fails, retain the Clerk identity and offer a retry. If Supabase
succeeds but Clerk deletion fails, show an explicit partial-completion state and
allow the still-authenticated user to retry identity deletion without recreating
data. Never claim full success on a partial result. Database and client tests must
prove that another user ID cannot be passed or affected.

The public store-listing surface should be a small static-first Vercel web project
created in 0.2-F only if none exists. It should explain in-app deletion and offer a
verified support/authentication path. Entering an email address must never directly
delete data. Do not deploy it in Release work without explicit approval.

## External configuration and credentials

| Work package | Required local/public configuration | Dashboard or secret configuration | Cost boundary |
| --- | --- | --- | --- |
| 0.2-B | none | none | no cost |
| 0.2-C | no hosted credentials; add SDK-compatible navigation packages | none | no cost |
| 0.2-D | public PostHog project key and host, plus environment label | create/configure a PostHog project; keep autocapture and replay disabled | use free allowance; no paid upgrade approved |
| 0.2-E | public Sentry DSN and environment/release context | create/configure a Sentry project; any source-map auth token belongs only in EAS/CI secrets, never `EXPO_PUBLIC_*` | use free allowance; tracing remains off |
| 0.2-F | no provider credentials for export; additive Supabase migration | Clerk must permit authenticated self-deletion; static web hosting remains undeployed | on-device export and database RPC add no paid service; Vercel Hobby commercial restriction must be revisited before monetization |
| 0.2-G | none for local validation | GitHub Actions workflow; public keys/secrets only if later validation truly requires them | CI must not invoke EAS builds or deployments |

Provider calls remain unchanged. Release 0.2 must not add an Instagram, place-data,
AI, email, payment, or storage provider. No purchase, hosted upgrade, production
deployment, DNS change, or external resource provisioning is authorized by this
record.

## Manual verification debt carried into later packages

- Android cold-start and warm-start share delivery in a development/preview build
- Android hardware back and Reset to Home after the Router migration
- Clerk sign-up, sign-in, sign-out, and session restoration on device
- iOS share-extension behavior in a native build and on a physical device
- Light, dark, and system appearance including large text and narrow screens
- PostHog identity reset and privacy inspection in its dashboard
- Sentry controlled exception, expected-error exclusion, and payload scrubbing
- Export destination/content on Android and iOS
- Complete and partial-failure account deletion in a non-production environment

