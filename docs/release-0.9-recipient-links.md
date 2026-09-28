# Release 0.9 — Package F recipient deep links

Implemented locally. Nothing was deployed, installed on a device, associated with a domain, or released by this package.

## Native boundary

`app/+native-intent.tsx` uses Expo Router's installed SDK-54 native-intent hook for both initial and subsequent links. A pure parser accepts the current build's exact custom scheme (`project-lemonade://shared#<token>` or the development variant), exact approved HTTPS `/s#<token>`, and the corresponding raw recipient paths supplied by the router. It rejects queries, encoded/ambiguous credentials, extra path segments, unsupported hosts and wrong-build schemes. Non-recipient paths retain existing handling. The Instagram text-share coordinator is unchanged.

The hook moves the credential to an in-memory recipient session and returns only `/shared`. No credential, owner ID or plan ID enters the route or navigation params. A new link replaces the session and invalidates outstanding reads; malformed recipient links clear it. No persistent storage, logging or public-view event is added. Close clears the session; backgrounding clears displayed content, aborts retrieval and refetches on foreground. Tokens remain transient in process memory to support a later refresh while the recipient screen is open.

`app/shared.tsx` is outside `(app)` and its private providers. It is available when Clerk is loading, signed out or signed in; the app group's guard requires a loaded signed-in session. It does not request a Clerk token or create a Supabase authenticated client. The installed application still needs its ordinary build configuration, including its existing Clerk publishable configuration; recipients do not need an account.

The screen displays only the strict public envelope, in order, with validated Google Maps actions, refresh, loading, empty and failure states. There is no path from a public row into an owner plan/place screen and no editing, saving or collaboration. Anonymous retrieval posts the bearer to the fixed public function, refuses redirects, omits credentials, streams under 64 KiB and uses a 15-second abort timeout. SDK 54 expo/fetch does not forward the RequestInit cache option, so the request also includes `Cache-Control: no-store`; the backend already supplies no-store response headers. Native requests have no browser referrer context. Exceptions are converted to fixed messages and never logged here.

## Browser fallback

The static builder accepts optional `LEMONADE_NATIVE_SHARING_SCHEME=project-lemonade` (or the explicit dev scheme). It requires an approved API endpoint and validates the scheme. **It remains blank/off in checked-in output.** Enable it only after a compatible native build has passed acceptance. A successful public view then offers Open in Lemonade. Only a click attempts the custom scheme; no automatic redirect, timer or invented store destination is used. If the app is absent, incompatible, or opening is blocked, the shortlist stays usable and the page explains the fallback.

Local browser fixture mode can enable this action using `LEMONADE_FIXTURE_NATIVE_OPEN=true`; this affects only the test server's in-memory configuration. It is never published.

## Domain association preparation

`script/sharing-associations.cjs` validates inputs and generates association files only when explicitly configured. No placeholder association files were generated. `app.config.js` leaves native domain filters unchanged by default.

Before generation, obtain and verify:

- Approved `EXPO_PUBLIC_SHARING_ORIGIN`: HTTPS origin with no port/path/query/fragment.
- `SHARING_APP_LINKS_ENABLED=true` only for the domain-association build.
- `SHARING_ANDROID_SHA256`: actual SHA-256 signing certificate fingerprint(s), comma-separated. For Play delivery use the Play app-signing certificate, not merely the upload key. For an installed development build use its actual certificate and matching development package.
- Optional `SHARING_IOS_APP_ID`: verified 10-character Apple Team ID plus the matching bundle identifier. Omit it until those values are known; iOS association is not inferred.

Run `node script/sharing-associations.cjs` from the repository root only after setting those public identifiers. It writes `web/.well-known/assetlinks.json` and, when supplied, `apple-app-site-association`. Production and dev identities remain distinct. Native Android VIEW filters target the exact HTTPS host and `/s`; iOS associatedDomains are added only with the explicit iOS identity. Generated web headers serve AASA as JSON. Preserve any separately managed association entries through review before generation; do not publish stale files from another variant.

These files/configuration are preparation, not verified Android App Links or iOS Universal Links. Publish them without redirects at the approved origin only after authorization, then verify against the actual installed build. No domain or certificate was guessed.

## Verification

- Full regression suite: 204 tests pass. Type checking passes. Android/Hermes bundle and static web build succeed.
- Focused tests cover canonical production/development/HTTPS parsing, invalid and wrong-host links, cold/warm hook calls, credential-free route output, replacement/clearing, anonymous fetch options, revoked/private/oversized responses, background/foreground clearing, absence of owner actions, signed-out/loading/signed-in root routing, opt-in association validation and browser fallback behavior.
- Browser fixture: the opt-in button renders on desktop/mobile; clicking with no compatible native handler leaves all three places visible and displays fallback guidance. Generic title remains unchanged; 390px viewport reports no horizontal overflow. This is desktop Edge with a mobile viewport, not an Android/iOS acceptance claim.
- Local installed Expo Router source confirms initial URL and subsequent URL listener paths invoke redirectSystemPath. OS-level URL delivery is not established by that code inspection or the unit tests.
- No adb command or Android SDK environment was available on PATH during this turn. No native device/emulator or iOS test was performed.

## Required device/release acceptance

Use a newly built compatible 0.9 app and disposable synthetic share credentials, since OS launch commands, browser history and diagnostic tools may retain supplied links. The repository still records appVersion runtime policy and version 0.8.0; version/build bump, native build and distribution are separate release work. Do not assume an OTA update to the old 0.8 binary is compatible (Package D added expo-clipboard).

1. With app closed and signed out, open a valid custom-scheme link: only the recipient screen appears, without sign-in or private-provider requests. Repeat signed in; then test HTTPS after domain verification.
2. While open, deliver a second link to the same screen. Only the new shortlist remains. Deliver an invalid, wrong-host, wrong-scheme, encoded-token or query-bearing link; no previous content remains. Confirm ordinary private navigation and Instagram imports still work.
3. After a successful view, disable/replace/delete the link's plan or account on another device. Refresh and background/foreground the recipient; subsequent retrieval must fail. Test offline refresh, timeout, empty plan and adding an unlabeled member.
4. Close/back from warm and cold entry. Check hardware/predictive back, large text, TalkBack, light/dark appearance and map opening. Verify no bearer appears in route state or app telemetry using disposable fixtures.
5. With no app installed and with domain associations absent, the browser shortlist stays usable. Test the explicit Open in Lemonade action with a compatible app, an older app and no app. Check Android Chrome and iOS Safari separately.
6. Verify Android domain status against release signing identity and HTTPS association responses. Only claim iOS Universal Link support after verified Apple identity and physical/simulator acceptance.

Hosted cache/logging/retention checks from Package E remain outstanding. Keep sharing and browser native opening off until their release gates are satisfied.

## Reference

[Expo native-intent documentation](https://docs.expo.dev/router/advanced/native-intent/) plus the installed SDK-54 `getLinkingConfig` and link listener implementation were checked for cold/warm interception behavior.
