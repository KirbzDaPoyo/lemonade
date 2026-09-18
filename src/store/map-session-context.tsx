import { errorMonitoring } from "../observability/error-monitoring";
import { AppState } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/expo";
import { MapSession, mockPositions } from "../services/map-session";
import {
  acquireLocation,
  type LocationState,
} from "../services/foreground-location";
import type { Position } from "../services/map-library";
import type { PlaceCard } from "../types/place";
import type { LocationResult } from "../../supabase/functions/_shared/placeLocations";
import { backendConfig } from "../config/backend";
import { analytics } from "../observability/analytics";
const Context = createContext<{
  resolve: (
    places: readonly PlaceCard[],
    refresh?: boolean,
  ) => Promise<LocationResult[]>;
  locate: () => Promise<void>;
  cancelLocation: () => void;
  location?: Position;
  locationState: LocationState;
}>(null!);
export function MapSessionProvider({ children }: { children: ReactNode }) {
  const { getToken, userId } = useAuth();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const session = useMemo(() => new MapSession(), [userId]);
  const alive = useRef(true);
  const [location, setLocation] = useState<Position>();
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const locating = useRef(false);
  const permissionPrompt = useRef(false);
  const locationGeneration = useRef(0);
  const cancelLocation = useCallback(() => {
    locationGeneration.current++;
    locating.current = false;
    setLocation(undefined);
    setLocationState("idle");
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" && !permissionPrompt.current)
        cancelLocation();
    });
    return () => sub.remove();
  }, [cancelLocation]);
  useEffect(() => {
    if (!location) return;
    const timer = setTimeout(() => {
      setLocation(undefined);
      setLocationState("stale");
    }, 120000);
    return () => clearTimeout(timer);
  }, [location]);
  useEffect(() => {
    alive.current = true;
    cancelLocation();
    return () => {
      alive.current = false;
      locationGeneration.current++;
      session.clear();
    };
  }, [session, cancelLocation]);
  const resolve = async (places: readonly PlaceCard[], refresh = false) =>
    session.resolve(
      places,
      async (ids) => {
        if (process.env.EXPO_PUBLIC_MAP_RESOLVER === "mock")
          return mockPositions(ids);
        const token = await tokenRef.current();
        if (!token || !alive.current) throw new Error("authentication");
        try {
          const claims = JSON.parse(
            atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
          );
          if (claims.sub !== userId) throw new Error();
        } catch {
          throw new Error("authentication");
        }
        if (!backendConfig.supabaseUrl || !backendConfig.supabasePublishableKey)
          throw new Error("configuration");
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 65000);
        try {
          const response = await fetch(
            `${backendConfig.supabaseUrl}/functions/v1/place-locations`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                apikey: backendConfig.supabasePublishableKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ids }),
              signal: controller.signal,
            },
          );
          const data = await response.json();
          if (!response.ok || !Array.isArray(data.results))
            throw new Error(
              [
                "authentication",
                "user_quota",
                "project_quota",
                "quota",
                "configuration",
                "invalid",
                "unavailable",
              ].includes(data.error)
                ? data.error
                : "unavailable",
            );
          return data.results;
        } catch (e) {
          if (
            e instanceof Error &&
            [
              "authentication",
              "user_quota",
              "project_quota",
              "quota",
              "configuration",
              "invalid",
              "unavailable",
            ].includes(e.message)
          )
            throw e;
          throw new Error(controller.signal.aborted ? "timeout" : "network");
        } finally {
          clearTimeout(timer);
        }
      },
      refresh,
    );
  const locate = async () => {
    if (locating.current) return;
    locating.current = true;
    const generation = ++locationGeneration.current;
    setLocation(undefined);
    setLocationState("loading");
    analytics.mapAction("nearby");
    try {
      const Location = await import("expo-location");
      const result = await acquireLocation({
        permission: async () => {
          permissionPrompt.current = true;
          try {
            return await Location.requestForegroundPermissionsAsync();
          } finally {
            permissionPrompt.current = false;
          }
        },
        enabled: Location.hasServicesEnabledAsync,
        current: () =>
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
      });
      if (alive.current && generation === locationGeneration.current) {
        setLocation(result.position);
        setLocationState(result.state);
        analytics.mapLocation(result.state);
        if (result.state === "unavailable")
          errorMonitoring.captureException(
            new Error("Location acquisition failed"),
            { operation: "location_acquisition", category: "map" },
          );
      }
    } catch {
      if (alive.current && generation === locationGeneration.current)
        setLocationState("unavailable");
    } finally {
      if (generation === locationGeneration.current) locating.current = false;
    }
  };
  return (
    <Context.Provider
      value={{ resolve, locate, cancelLocation, location, locationState }}
    >
      {children}
    </Context.Provider>
  );
}
export const useMapSession = () => useContext(Context);
