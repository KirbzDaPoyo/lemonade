import { errorMonitoring } from "../observability/error-monitoring";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  Linking,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { V2Button, V2TextField } from "../components/v2-controls";
import { V2TopBar, V2TitleBlock } from "../components/v2-layout";
import { V2FilterRack } from "../components/v2-filter-rack";
import { SavedMap } from "../components/saved-map";
import { MapButtons } from "../components/map-buttons";
import { useAppTheme } from "../design-system/theme";
import { usePlaces } from "../store/PlacesContext";
import { useMapSession } from "../store/map-session-context";
import { defaultLibraryView, libraryOptions } from "../services/library-view";
import { getAssignedTagFilterOptions } from "../services/placeFilters";
import {
  mapScope,
  nearbyPlaces,
  formatDistance,
  type Position,
} from "../services/map-library";
import type { AppNavigation } from "../navigation/types";
import { analytics } from "../observability/analytics";
import { statusLabels } from "../utils/labels";
const messages: Record<string, string> = {
  authentication: "Your session changed. Sign in again.",
  user_quota: "Your daily map allowance is used. Try tomorrow (UTC).",
  project_quota: "The shared daily map allowance is used. Try tomorrow (UTC).",
  quota: "Map allowance is unavailable. Try later.",
  configuration: "Position resolution is not configured for this build.",
  network: "Connection unavailable. Check your connection and retry.",
  timeout:
    "The request timed out. Retry deliberately; the previous attempt may count toward your daily allowance.",
  unavailable:
    "These positions are unavailable. Refresh your library and retry.",
  invalid: "This map scope is invalid. Refine your filters.",
};
const locationCopy: Record<string, string> = {
  idle: "Area browsing works without location.",
  loading: "Getting one foreground location fix…",
  precise:
    "Location ready. Distances are approximate straight-line estimates, not routes or travel times.",
  approximate:
    "Approximate location ready. Distances are straight-line estimates, not routes or travel times.",
  denied: "Location was denied. You can retry or keep browsing by area.",
  blocked:
    "Location permission is blocked. Enable it in system settings if you want nearby distances.",
  disabled: "Location services are off. Enable them in settings, then retry.",
  timeout: "Location timed out. Retry or continue without distances.",
  stale: "Location was too old or inaccurate. Retry or continue by area.",
  unavailable: "Location is unavailable. Retry or continue by area.",
};
export function MapLibraryScreen({
  navigation,
}: {
  navigation: AppNavigation;
}) {
  const { theme } = useAppTheme();
  const library = usePlaces();
  const session = useMapSession();
  const [view, setView] = useState({ ...defaultLibraryView });
  const [mode, setMode] = useState<"map" | "list">("map");
  const [radius, setRadius] = useState<number>();
  const [selected, setSelected] = useState<string>();
  const [loaded, setLoaded] = useState<{
    key: string;
    ids: string[];
    positions: Map<string, Position>;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [partial, setPartial] = useState(0);
  const mounted = useRef(true);
  const locked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    analytics.mapAction("opened");
    return () => {
      mounted.current = false;
      session.cancelLocation();
    };
  }, []);
  const scope = useMemo(
    () => mapScope(library.places, view),
    [library.places, view],
  );
  const loadedPlaces = library.places.filter((p) => loaded?.ids.includes(p.id));
  const rows = nearbyPlaces(
    loadedPlaces,
    loaded?.positions ?? new Map(),
    session.location,
    radius,
  );
  const selectedPlace = rows.find((r) => r.place.id === selected)?.place;
  useEffect(() => {
    if (selected && !rows.some((r) => r.place.id === selected))
      setSelected(undefined);
  }, [selected, rows.map((r) => r.place.id).join("|")]);
  const leave = () => {
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      return;
    }
    if (selected) {
      setSelected(undefined);
      return;
    }
    navigation.goBack();
  };
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        leave();
        return true;
      });
      return () => sub.remove();
    }, [selected, navigation]),
  );
  const load = async (refresh = false) => {
    if (!scope.valid || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    Keyboard.dismiss();
    analytics.mapAction("load_requested");
    try {
      const results = await session.resolve(scope.eligible, refresh);
      if (!mounted.current) return;
      const positions = new Map<string, Position>();
      for (const result of results)
        if ("latitude" in result)
          positions.set(result.id, {
            latitude: result.latitude,
            longitude: result.longitude,
          });
      const failures = results.length - positions.size;
      setPartial(failures);
      if (!positions.size) {
        setError(
          "No positions could be resolved. Any previously loaded results remain below. Retry when ready.",
        );
        analytics.mapAction("load_failed");
        return;
      }
      setLoaded({
        key: scope.key,
        ids: scope.eligible.map((p) => p.id),
        positions,
      });
      analytics.mapAction(failures ? "load_partial" : "load_succeeded");
    } catch (e) {
      if (mounted.current) {
        analytics.mapFailure(e instanceof Error ? e.message : "unavailable");
        if (
          e instanceof Error &&
          ["unavailable", "configuration", "quota"].includes(e.message)
        )
          errorMonitoring.captureException(new Error("Map operation failed"), {
            operation:
              e.message === "configuration"
                ? "map_configuration"
                : e.message === "quota"
                  ? "map_quota"
                  : "map_resolution",
            category: "map",
          });
        setError(
          messages[e instanceof Error ? e.message : ""] ??
            "Map loading failed. Retry when ready.",
        );
        analytics.mapAction("load_failed");
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const select = (id: string) => {
    setSelected(id);
    analytics.mapAction("selected");
  };
  const text = { color: theme.colors.text, fontSize: 16 };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
      >
        <V2TopBar onBack={leave} />
        <V2TitleBlock
          title="YOUR MAP"
          subtitle="Only places from your saved library."
        />
        {process.env.EXPO_PUBLIC_MAP_RESOLVER === "mock" ? (
          <Text style={text}>
            DEMO POSITIONS — synthetic coordinates, not real venue locations.
          </Text>
        ) : null}
        <V2TextField
          label="Search saved places"
          value={view.query}
          onChangeText={(query) => setView((v) => ({ ...v, query }))}
        />
        <V2FilterRack filtersOnly
          view={view}
          tags={getAssignedTagFilterOptions(
            library.places,
            library.availableTags,
          )}
          categories={libraryOptions(library.places, "category")}
          areas={libraryOptions(library.places, "areaCity")}
          onFilterChange={(changes) => setView((v) => ({ ...v, ...changes }))}
          onClearFilters={() => setView({ ...defaultLibraryView })}
          onSortChange={(sort) => setView((v) => ({ ...v, sort }))}
          onDensityChange={(density) => setView((v) => ({ ...v, density }))}
        />
        {library.isLoading ? (
          <Text style={text}>Loading saved library…</Text>
        ) : null}
        {library.storageError ? (
          <>
            <Text style={text}>{library.storageError}</Text>
            <V2Button label="Retry library" onPress={library.retryStorage} />
          </>
        ) : null}
        <Text accessibilityLiveRegion="polite" style={text}>
          {scope.eligible.length} eligible places. {scope.unmappable} matching
          places lack a Google Place ID.
        </Text>
        {!scope.eligible.length ? (
          <Text style={text}>
            No mappable places match. Try another area or clear the filters.
          </Text>
        ) : scope.eligible.length > 20 ? (
          <Text style={text}>
            Refine your search or filters to 20 eligible places or fewer. No
            subset will be loaded automatically.
          </Text>
        ) : null}
        <V2Button
          label={
            busy ? "Loading positions…" : `Show ${scope.eligible.length} places`
          }
          disabled={busy || !scope.valid || library.isLoading}
          onPress={() => void load()}
        />
        {loaded ? (
          <>
            <Text accessibilityLiveRegion="polite" style={text}>
              {loaded.key !== scope.key
                ? "Filters changed — results below still show the previously loaded scope."
                : "Showing the loaded scope."}{" "}
              {loaded.positions.size} resolved places.
            </Text>
            <V2Button
              variant="ghost"
              disabled={busy || !scope.valid || loaded.key !== scope.key}
              label={
                partial
                  ? "Retry unresolved positions"
                  : "Refresh positions explicitly"
              }
              onPress={() => void load(!partial)}
            />
          </>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={text}>
            {error}
          </Text>
        ) : null}
        {partial > 0 ? (
          <Text style={text}>
            {partial} positions could not be resolved. Only successful results
            appear.
          </Text>
        ) : null}
        <V2Button
          variant="secondary"
          label={
            session.locationState === "loading"
              ? "Getting location…"
              : "Near me / use my location"
          }
          disabled={session.locationState === "loading"}
          onPress={() => void session.locate()}
        />
        <Text accessibilityLiveRegion="polite" style={text}>
          {locationCopy[session.locationState]}
        </Text>
        {session.locationState === "blocked" ||
        session.locationState === "disabled" ? (
          <V2Button
            label="Open system settings"
            onPress={() => {
              void Linking.openSettings().catch(() =>
                setError(
                  "System settings could not open. Open your device settings manually.",
                ),
              );
            }}
          />
        ) : null}
        {session.location ? (
          <View style={{ gap: 8, flexDirection: "row", flexWrap: "wrap" }}>
            {[undefined, 1, 3, 5, 10].map((km) => (
              <V2Button
                key={km ?? "all"}
                selected={radius === km}
                variant={radius === km ? "primary" : "ghost"}
                label={km ? `${km} km` : "All loaded"}
                onPress={() => {
                  setRadius(km);
                  analytics.mapAction("radius_changed");
                }}
              />
            ))}
          </View>
        ) : null}
        <Text style={text}>Radius applies only to this loaded set.</Text>
        {loaded ? (
          <Text
            accessibilityLabel="Google Maps attribution"
            style={{ color: theme.colors.text, fontSize: 14 }}
          >
            Google Maps
          </Text>
        ) : null}
        <V2Button
          variant="secondary"
          label={mode === "map" ? "Show nearby list" : "Show map"}
          onPress={() => {
            setMode((m) => (m === "map" ? "list" : "map"));
            analytics.mapAction("mode_changed");
          }}
        />
        {loaded && mode === "map" ? (
          <SavedMap
            scopeKey={loaded.key}
            markers={rows.map((r) => ({
              id: r.place.id,
              name: r.place.placeName,
              position: r.position,
            }))}
            selected={selected}
            onSelect={select}
          />
        ) : null}
        {loaded && !rows.length ? (
          <Text style={text}>
            No loaded places inside this radius. Choose a larger radius or All
            loaded.
          </Text>
        ) : null}
        {rows.map((row, index) => (
          <View
            key={row.place.id}
            style={{
              gap: 8,
              padding: 12,
              borderWidth: selected === row.place.id ? 2 : 1,
              borderColor: theme.colors.borderStrong,
            }}
          >
            <V2Button
              selected={selected === row.place.id}
              variant="ghost"
              label={`${selected === row.place.id ? "Selected · " : ""}${index + 1}. ${row.place.placeName}`}
              onPress={() => select(row.place.id)}
            />
            <Text style={text}>
              {row.place.areaCity} · {row.place.category} ·{" "}
              {statusLabels[row.place.status]}
              {row.place.isFavorite ? " · Favorite" : ""}
            </Text>
            {row.distance !== undefined ? (
              <Text style={text}>{formatDistance(row.distance)}</Text>
            ) : null}
          </View>
        ))}
        {selectedPlace ? (
          <View style={{ gap: 12 }}>
            <Text style={text}>Selected: {selectedPlace.placeName}</Text>
            <Text style={text}>
              {selectedPlace.cuisineOrSpecialty}{" "}
              {selectedPlace.tags.join(" · ")}
              {selectedPlace.notes ? " · Has notes" : ""}
            </Text>
            <V2Button
              label="Open place details"
              onPress={() => {
                analytics.mapAction("place_opened");
                navigation.navigate({
                  name: "PlaceDetail",
                  placeId: selectedPlace.id,
                });
              }}
            />
            <V2Button
              variant="secondary"
              label="Add to outing plan"
              onPress={() => {
                analytics.mapAction("plan_started");
                navigation.navigate({
                  name: "Plans",
                  addPlaceId: selectedPlace.id,
                });
              }}
            />
            <MapButtons place={selectedPlace} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
