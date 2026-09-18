import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  distanceKm,
  validPosition,
  formatDistance,
  mapScope,
  nearbyPlaces,
} from "../src/services/map-library";
import { defaultLibraryView } from "../src/services/library-view";
import { MapSession } from "../src/services/map-session";
import {
  acquireLocation,
  type LocationAdapter,
} from "../src/services/foreground-location";
import {
  createLocationHandler,
  parseLocationIds,
  downwardLimit,
  type ResolverDependencies,
} from "../supabase/functions/_shared/placeLocations";
import type { PlaceCard } from "../src/types/place";
const place = (
  id: string,
  placeId: string | undefined = "google-" + id,
): PlaceCard => ({
  id,
  placeId,
  placeName: id,
  address: "",
  areaCity: "Taipei",
  category: "cafe",
  sources: [],
  tags: [],
  sourceInstagramUrl: "",
  status: "want_to_go",
  isFavorite: false,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
});
const position = { latitude: 25, longitude: 121 };
test("geography validates coordinates, handles dateline, distance formatting and deterministic ties", () => {
  assert.equal(distanceKm(position, position), 0);
  assert.ok(
    Math.abs(
      distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) -
        111.195,
    ) < 0.01,
  );
  assert.ok(
    distanceKm(
      { latitude: 0, longitude: 179.9 },
      { latitude: 0, longitude: -179.9 },
    ) < 23,
  );
  for (const p of [
    null,
    {},
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: 181 },
    { latitude: NaN, longitude: 0 },
  ])
    assert.equal(validPosition(p), false);
  assert.throws(() =>
    distanceKm({ latitude: Infinity, longitude: 0 }, position),
  );
  assert.equal(formatDistance(0.2), "about 200 m");
  assert.equal(formatDistance(2), "about 2.0 km");
  assert.equal(formatDistance(NaN), "");
  const rows = nearbyPlaces(
    [place("b"), place("a")],
    new Map([
      ["a", position],
      ["b", position],
    ]),
    position,
    1,
  );
  assert.deepEqual(
    rows.map((r) => r.place.id),
    ["a", "b"],
  );
  assert.equal(
    nearbyPlaces(
      [place("a")],
      new Map([["a", position]]),
      { latitude: 0, longitude: 0 },
      1,
    ).length,
    0,
  );
});
test("scope reuses combined library filters and refuses empty, unmappable and over-limit sets", () => {
  assert.equal(mapScope([], defaultLibraryView).valid, false);
  assert.equal(mapScope([place("a", "")], defaultLibraryView).unmappable, 1);
  assert.equal(
    mapScope(
      Array.from({ length: 21 }, (_, i) => place(String(i))),
      defaultLibraryView,
    ).valid,
    false,
  );
  assert.equal(
    mapScope(
      Array.from({ length: 20 }, (_, i) => place(String(i))),
      defaultLibraryView,
    ).valid,
    true,
  );
  const a = { ...place("a"), isFavorite: true, tags: ["Dinner"] };
  assert.equal(
    mapScope([a, place("b")], {
      ...defaultLibraryView,
      query: "taipei",
      favoritesOnly: true,
      tag: "Dinner",
      category: "cafe",
      area: "taipei",
    }).eligible.length,
    1,
  );
  assert.equal(
    mapScope([a, place("b")], defaultLibraryView).key,
    mapScope([place("b"), a], defaultLibraryView).key,
  );
});
test("session coalesces requests, reuses positions and clears late account results", async () => {
  const session = new MapSession();
  let calls = 0;
  let finish!: (value: any) => void;
  const request = async () => {
    calls++;
    return new Promise<any>((r) => (finish = r));
  };
  const a = session.resolve([place("a")], request);
  const b = session.resolve([place("a")], request);
  finish([{ id: "a", ...position }]);
  assert.deepEqual(await a, await b);
  assert.equal(calls, 1);
  await session.resolve([place("a")], request);
  assert.equal(calls, 1);
  const late = session.resolve([place("b")], request);
  session.clear();
  finish([{ id: "b", ...position }]);
  await assert.rejects(late, /authentication/);
  let refreshed = 0;
  await session.resolve([place("a")], async () => {
    refreshed++;
    return [{ id: "a", ...position }];
  });
  assert.equal(refreshed, 1);
});
test("session retries only unresolved positions and refresh is explicit", async () => {
  const session = new MapSession();
  const inputs: string[][] = [];
  const request = async (ids: string[]) => {
    inputs.push(ids);
    return ids.map((id) =>
      id === "b" && inputs.length === 1
        ? { id, failure: "provider" as const }
        : { id, ...position },
    );
  };
  await session.resolve([place("a"), place("b")], request);
  await session.resolve([place("a"), place("b")], request);
  await session.resolve([place("a"), place("b")], request, true);
  assert.deepEqual(inputs, [["a", "b"], ["b"], ["a", "b"]]);
  await assert.rejects(session.resolve([], request));
  await assert.rejects(session.resolve([place("x", "")], request));
});
const adapter = (
  overrides: Partial<LocationAdapter> = {},
): LocationAdapter => ({
  permission: async () => ({ granted: true, canAskAgain: true }),
  enabled: async () => true,
  current: async () => ({
    timestamp: Date.now(),
    coords: { ...position, accuracy: 20 },
  }),
  ...overrides,
});
test("one-shot location handles precise, approximate, denial, blocked, disabled, timeout, stale and retry", async () => {
  assert.equal((await acquireLocation(adapter())).state, "precise");
  assert.equal(
    (
      await acquireLocation(
        adapter({
          permission: async () => ({
            granted: true,
            canAskAgain: true,
            android: { accuracy: "coarse" },
          }),
        }),
      )
    ).state,
    "approximate",
  );
  for (const again of [true, false])
    assert.equal(
      (
        await acquireLocation(
          adapter({
            permission: async () => ({ granted: false, canAskAgain: again }),
            current: async () => {
              throw Error("must not call");
            },
          }),
        )
      ).state,
      again ? "denied" : "blocked",
    );
  assert.equal(
    (await acquireLocation(adapter({ enabled: async () => false }))).state,
    "disabled",
  );
  assert.equal(
    (
      await acquireLocation(
        adapter({ current: () => new Promise(() => {}) }),
        2,
      )
    ).state,
    "timeout",
  );
  assert.equal(
    (
      await acquireLocation(
        adapter({
          current: async () => ({
            timestamp: 0,
            coords: { ...position, accuracy: 1 },
          }),
        }),
      )
    ).state,
    "stale",
  );
  assert.equal(
    (
      await acquireLocation(
        adapter({
          current: async () => {
            throw Error("raw secret");
          },
        }),
      )
    ).state,
    "unavailable",
  );
  assert.equal((await acquireLocation(adapter())).state, "precise");
});
const request = (body: unknown) =>
  new Request("https://fixture.test", {
    method: "POST",
    body: JSON.stringify(body),
  });
function fixture(overrides: Partial<ResolverDependencies> = {}) {
  const calls: string[] = [];
  const deps: ResolverDependencies = {
    authenticate: async () => "verified-owner",
    owned: async (ids, owner) => {
      assert.equal(owner, "verified-owner");
      return ids.map((id) => ({
        id,
        place_id: id === "unmapped" ? null : "google-" + id,
      }));
    },
    reserve: async (_owner, count) => {
      calls.push("reserve:" + count);
      return "ok";
    },
    apiKey: "fixture-key",
    fetch: async (input, init) => {
      calls.push("fetch");
      assert.equal(
        (init?.headers as Record<string, string>)["X-Goog-FieldMask"],
        "id,location",
      );
      return Response.json({
        id: decodeURIComponent(String(input).split("/").pop()!),
        location: position,
      });
    },
    ...overrides,
  };
  return { calls, handler: createLocationHandler(deps) };
}
test("resolver rejects malformed input and unauthenticated/cross-owner requests before quota or Google", async () => {
  for (const body of [
    { ids: [] },
    { ids: [""] },
    { ids: ["a"], userId: "forge" },
    { ids: Array(21).fill("a") },
    { ids: [1] },
  ])
    assert.throws(() => parseLocationIds(body));
  assert.deepEqual(parseLocationIds({ ids: ["a", "a", " b "] }), ["a", "b"]);
  const denied = fixture({
    authenticate: async () => {
      throw Error("raw");
    },
  });
  assert.equal((await denied.handler(request({ ids: ["a"] }))).status, 401);
  assert.deepEqual(denied.calls, []);
  const foreign = fixture({ owned: async () => [] });
  assert.equal((await foreign.handler(request({ ids: ["a"] }))).status, 404);
  assert.deepEqual(foreign.calls, []);
});
test("resolver reserves eligible attempts before Google and returns only minimal positions", async () => {
  const f = fixture();
  const response = await f.handler(request({ ids: ["a", "a", "unmapped"] }));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    results: [
      { id: "unmapped", failure: "unavailable" },
      { id: "a", ...position },
    ],
  });
  assert.deepEqual(f.calls, ["reserve:1", "fetch"]);
  for (const quota of ["user_quota", "project_quota"]) {
    const denied = fixture({ reserve: async () => quota });
    assert.equal((await denied.handler(request({ ids: ["a"] }))).status, 429);
    assert.deepEqual(denied.calls, []);
  }
  const missing = fixture({ apiKey: undefined });
  assert.equal((await missing.handler(request({ ids: ["a"] }))).status, 503);
  assert.deepEqual(missing.calls, []);
});
test("resolver bounds concurrency, handles partial/moved/invalid/error/timeout and never retries", async () => {
  let active = 0,
    max = 0,
    calls = 0;
  const f = fixture({
    fetch: async (input) => {
      calls++;
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      const id = String(input).split("/").pop();
      if (id === "google-a")
        return Response.json({ secret: "raw" }, { status: 500 });
      if (id === "google-b")
        return Response.json({ id: "moved", location: position });
      if (id === "google-c")
        return Response.json({ id, location: { latitude: 999, longitude: 0 } });
      return Response.json({ id, location: position });
    },
  });
  const data = await (
    await f.handler(request({ ids: ["a", "b", "c", "d", "e"] }))
  ).json();
  assert.equal(max, 3);
  assert.equal(calls, 5);
  assert.equal(data.results.filter((r: any) => "latitude" in r).length, 2);
  assert.doesNotMatch(JSON.stringify(data), /raw|secret/);
  const timeout = fixture({
    timeoutMs: 2,
    fetch: async (_input, init) =>
      new Promise((_r, reject) =>
        init?.signal?.addEventListener("abort", () => reject(Error("raw"))),
      ),
  });
  assert.equal(
    (await (await timeout.handler(request({ ids: ["a"] }))).json()).results[0]
      .failure,
    "timeout",
  );
  assert.equal(downwardLimit("999", 60), 60);
  assert.equal(downwardLimit("0", 60), 0);
  assert.equal(downwardLimit("10", 60), 10);
});
test("map location state is transient and native map has no user-location subscription", () => {
  for (const file of [
    "src/services/map-session.ts",
    "src/services/foreground-location.ts",
    "src/store/map-session-context.tsx",
  ])
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /SecureStore|AsyncStorage|writeFile|watchPosition|requestBackground/,
    );
  const native = readFileSync("src/components/saved-map.native.tsx", "utf8");
  assert.match(native, /PROVIDER_GOOGLE/);
  assert.match(native, /showsUserLocation=\{false\}/);
  assert.doesNotMatch(native, /onRegionChange/);
  assert.doesNotMatch(
    readFileSync("src/components/saved-map.tsx", "utf8"),
    /react-native-maps/,
  );
});

import {
  flatten,
  hooks,
  load,
  rn,
  theme,
  tick,
} from "./helpers/component-harness";
test("map screen loads only explicitly, separates pending filters, synchronizes selection and reuses plan actions", async () => {
  const h = hooks();
  const calls: any[] = [];
  let resolves = 0,
    locations = 0,
    back: () => boolean = () => false;
  const places = [place("a"), place("b")];
  const session = {
    location: undefined,
    locationState: "idle",
    cancelLocation() {},
    locate: async () => {
      locations++;
    },
    resolve: async () => {
      resolves++;
      return places.map((p) => ({ id: p.id, ...position }));
    },
  };
  const { MapLibraryScreen } = load("src/screens/map-library-screen.tsx", {
    "../observability/error-monitoring": {
      errorMonitoring: { captureException() {} },
    },
    react: h.react,
    "react-native": {
      ...rn,
      Keyboard: { isVisible: () => false, dismiss() {} },
      BackHandler: {
        addEventListener: (_name: string, fn: any) => {
          back = fn;
          return { remove() {} };
        },
      },
      Linking: { openSettings: async () => {} },
    },
    "expo-router": { useFocusEffect: (fn: any) => fn() },
    "react-native-safe-area-context": { SafeAreaView: "SafeArea" },
    "../components/v2-controls": { V2Button: "Button", V2TextField: "Field" },
    "../components/v2-layout": { V2TopBar: "Top", V2TitleBlock: "Title" },
    "../components/v2-filter-rack": { V2FilterRack: "Filters" },
    "../components/saved-map": { SavedMap: "Map" },
    "../components/map-buttons": { MapButtons: "Maps" },
    "../design-system/theme": { useAppTheme: () => ({ theme }) },
    "../store/PlacesContext": {
      usePlaces: () => ({ places, availableTags: [], isLoading: false }),
    },
    "../store/map-session-context": { useMapSession: () => session },
    "../observability/analytics": {
      analytics: { mapAction() {}, mapFailure() {} },
    },
  });
  const navigation = {
    navigate: (route: any) => calls.push(route),
    goBack: () => calls.push("back"),
  };
  const render = () => h.render(() => MapLibraryScreen({ navigation }));
  const button = (label: string) =>
    flatten(render()).find(
      (n) => n.type === "Button" && n.props.label === label,
    );
  render();
  assert.equal(resolves, 0);
  assert.equal(locations, 0);
  button("Show 2 places").props.onPress();
  await tick();
  assert.equal(resolves, 1);
  const map = flatten(render()).find((n) => n.type === "Map");
  assert.equal(map.props.markers.length, 2);
  map.props.onSelect("a");
  render();
  assert.ok(button("Selected · 1. a"));
  button("Open place details").props.onPress();
  assert.equal(calls[0].name, "PlaceDetail");
  assert.equal(calls[0].placeId, "a");
  button("Add to outing plan").props.onPress();
  assert.equal(calls[1].addPlaceId, "a");
  assert.equal(resolves, 1);
  button("Show nearby list").props.onPress();
  assert.equal(
    flatten(render()).some((n) => n.type === "Map"),
    false,
  );
  button("Show map").props.onPress();
  assert.equal(resolves, 1);
  flatten(render())
    .find((n) => n.type === "Field")
    .props.onChangeText("missing");
  assert.ok(
    flatten(render()).some((n) =>
      JSON.stringify(n.props?.children)?.includes("Filters changed"),
    ),
  );
  assert.equal(resolves, 1);
  back();
  render();
  assert.equal(button("Open place details"), undefined);
  assert.equal(calls.includes("back"), false);
  back();
  assert.ok(calls.includes("back"));
  button("Near me / use my location").props.onPress();
  assert.equal(locations, 1);
  h.unmount();
});
test("map analytics reject location-bearing values and Sentry scrubs geographic context", () => {
  const events: any[] = [];
  const stubs: any = {
    "expo-application": {},
    "expo-constants": { default: { expoConfig: {} } },
    "react-native": { Platform: { OS: "android" } },
    "posthog-react-native": {
      PostHog: class {
        capture(name: string, props: any) {
          events.push({ name, props });
        }
      },
    },
  };
  const { analytics } = load("src/observability/analytics.ts", stubs);
  analytics.mapAction("opened");
  analytics.mapAction({ latitude: 25 });
  analytics.mapLocation("25,121");
  analytics.mapFailure("secret provider response");
  assert.equal(events.length, 1);
  assert.deepEqual(Object.keys(events[0].props).sort(), [
    "action",
    "app_build",
    "app_version",
    "environment",
    "platform",
  ]);
  const { scrubSentryEvent } = load("src/observability/error-monitoring.ts", {
    "expo-application": {},
    "expo-constants": { default: { expoConfig: {} } },
    "react-native": { Platform: { OS: "android" } },
    "@sentry/react-native": {},
  });
  const result = scrubSentryEvent({
    contexts: {
      geo: {
        latitude: 25,
        longitude: 121,
        accuracy: 30,
        distance: 2,
        viewport: [1, 2],
        bounds: { x: 5 },
        center: [1, 2],
        zoom: 4,
        city: "secret",
        tags: ["private"],
      },
    },
    breadcrumbs: [{ data: position }],
    extra: position,
  });
  assert.doesNotMatch(JSON.stringify(result), /25|121|secret|private/);
  assert.equal(result.breadcrumbs, undefined);
});

test("provider survives the Android permission dialog and discards acquisition after cancellation or account change", async () => {
  const h = hooks();
  let userId = "first",
    requests = 0;
  let finish!: (result: any) => void;
  let appState!: (state: string) => void;
  const { MapSessionProvider } = load("src/store/map-session-context.tsx", {
    react: h.react,
    "@clerk/expo": { useAuth: () => ({ userId, getToken: async () => null }) },
    "react-native": {
      AppState: {
        addEventListener: (_event: string, fn: any) => {
          appState = fn;
          return { remove() {} };
        },
      },
    },
    "../services/foreground-location": {
      acquireLocation: async (adapter: LocationAdapter) => {
        requests++;
        await adapter.permission();
        return new Promise((r) => (finish = r));
      },
    },
    "expo-location": {
      Accuracy: { Balanced: 3 },
      requestForegroundPermissionsAsync: async () => {
        appState("background");
        return { granted: true, canAskAgain: true };
      },
    },
    "../observability/error-monitoring": {
      errorMonitoring: { captureException() {} },
    },
    "../observability/analytics": {
      analytics: { mapAction() {}, mapLocation() {} },
    },
  });
  const render = () =>
    h.render(() => MapSessionProvider({ children: null })).props.value;
  render();
  assert.equal(requests, 0);
  const first = render().locate();
  await tick();
  assert.equal(requests, 1);
  assert.equal(render().locationState, "loading");
  render().cancelLocation();
  finish({ state: "precise", position });
  await first;
  assert.equal(render().location, undefined);
  const second = render().locate();
  await tick();
  userId = "second";
  render();
  finish({ state: "precise", position });
  await second;
  assert.equal(render().location, undefined);
  const third = render().locate();
  await tick();
  finish({ state: "approximate", position });
  await third;
  assert.equal(render().location.latitude, 25);
  appState("background");
  assert.equal(render().location, undefined);
  h.unmount();
});
test("invalid responses cannot partially populate the cache and failed refreshes remain retryable", async () => {
  const session = new MapSession();
  let calls = 0;
  await assert.rejects(
    session.resolve([place("a"), place("b")], async () => [
      { id: "a", ...position },
      { id: "b", latitude: 999, longitude: 0 },
    ]),
  );
  await session.resolve([place("a")], async () => {
    calls++;
    return [{ id: "a", ...position }];
  });
  assert.equal(calls, 1);
  await session.resolve(
    [place("a")],
    async () => [{ id: "a", failure: "provider" }],
    true,
  );
  await session.resolve([place("a")], async () => {
    calls++;
    return [{ id: "a", ...position }];
  });
  assert.equal(calls, 2);
});
test("public privacy and deletion drafts explain transient location and operational counters", () => {
  const privacy = readFileSync("web/privacy.html", "utf8");
  assert.match(privacy, /Foreground location/);
  assert.match(privacy, /memory/);
  assert.match(privacy, /Google Privacy Policy/);
  assert.match(privacy, /schema 4/);
  assert.match(
    readFileSync("web/index.html", "utf8"),
    /user-scoped map usage counters/,
  );
  assert.match(
    readFileSync("web/terms.html", "utf8"),
    /Google Maps\/Google Earth Additional Terms/,
  );
});
