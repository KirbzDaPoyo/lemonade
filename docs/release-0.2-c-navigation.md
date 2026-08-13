# Release 0.2-C: Expo Router navigation

## Outcome

Project Lemonade now uses Expo Router as its only navigation system. The former
in-memory stack has been removed, while the current screens and visual system
remain unchanged.

## Route map

```text
app/
  _layout.tsx
  +not-found.tsx
  (auth)/
    _layout.tsx
    sign-in.tsx
  (app)/
    _layout.tsx
    index.tsx
    account.tsx
    add-place.tsx
    match-place.tsx
    place/[placeId].tsx
```

- Clerk session state protects the authenticated and signed-out route groups.
- Native route history now powers header back controls and Android system back.
- Reset-to-home dismisses nested history before returning to the saved index.
- Place details encode only the durable `placeId` in the route.
- Instagram import drafts and candidates stay in an authenticated, transient
  context instead of being serialized into URLs.
- Incoming Android shares reset stale navigation, prefill Add Place, and wait
  for the user to start matching.

## Configuration changes

- The package entry point is `expo-router/entry`.
- `expo-router` and `react-native-screens` are installed through Expo.
- The Expo Router config plugin is enabled in `app.json`.

## Automated verification

- `npm test`
- `npm run typecheck`
- `npx expo-doctor`
- `npx expo export --platform android`

## Device acceptance checklist

1. Signed-out launch opens Sign In; successful authentication opens Saved Places.
2. Account, Add Place, Match Place, and Place Detail support both visible back
   controls and Android system back.
3. Add Place -> Match Place allows changing the selected candidate before
   Save Place, and saving opens the new Place Detail record.
