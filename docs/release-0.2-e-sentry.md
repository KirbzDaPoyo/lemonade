# Release 0.2-E — Sentry error monitoring

## Outcome

Project Lemonade now reports unexpected technical failures to Sentry while keeping expected product outcomes in the UI and PostHog. The integration is a no-op when `EXPO_PUBLIC_SENTRY_DSN` is absent.

## Free-plan boundary

- Errors only; tracing and profiling sample rates are `0`.
- Session Replay and logs are disabled.
- No payment method, pay-as-you-go feature, or paid Sentry product is required.
- The preview DSN is stored as an EAS project environment variable rather than committed to Git.

## Privacy boundary

The `beforeSend` scrubber removes request data, extras, breadcrumbs, authentication material, email-like values, URLs, captions, notes, query text, provider bodies, addresses, and other place/user-entered fields. Sentry user correlation contains only the Clerk user ID. Reports contain stable operation/category tags plus app version, native build, platform, environment, and release channel.

## Recovery boundaries

Accessible retry/leave states protect:

- the application frame;
- the authenticated navigation and saved-place surface;
- the add-place and candidate-matching import flow.

Unexpected failures from auth transitions, place search, saved-place hydration, and saved-place writes are captured. Expected cases such as invalid URLs, private posts, rate limits, and zero candidates remain handled product states.

## Source maps

Readable production stack traces require a Sentry organization auth token stored only as the EAS secret `SENTRY_AUTH_TOKEN`. The token must never be committed or pasted into chat. Base error capture works without it, but source-map upload will remain unavailable until the secret is configured directly in EAS.

## Verification

Run:

```text
npm test
npm run typecheck
npx expo-doctor
npx expo config --type public
```

Then install the next preview build and confirm normal navigation, imports, storage retries, and theme persistence. A controlled exception may be added only to a development build for one-time transport verification; it must not be reachable in production UI.