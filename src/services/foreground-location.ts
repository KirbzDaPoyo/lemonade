import { validPosition, type Position } from "./map-library";
export type LocationState =
  | "idle"
  | "loading"
  | "precise"
  | "approximate"
  | "denied"
  | "blocked"
  | "disabled"
  | "timeout"
  | "stale"
  | "unavailable";
export type LocationAdapter = {
  permission: () => Promise<{
    granted: boolean;
    canAskAgain: boolean;
    android?: { accuracy?: string };
    ios?: { scope?: string };
  }>;
  enabled: () => Promise<boolean>;
  current: () => Promise<{
    timestamp: number;
    coords: Position & { accuracy: number | null };
  }>;
};
export async function acquireLocation(
  adapter: LocationAdapter,
  timeoutMs = 15000,
): Promise<{ state: LocationState; position?: Position }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const permission = await adapter.permission();
    if (!permission.granted)
      return { state: permission.canAskAgain ? "denied" : "blocked" };
    if (!(await adapter.enabled())) return { state: "disabled" };
    const fix = await Promise.race([
      adapter.current(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    if (!fix) return { state: "timeout" };
    if (
      !validPosition(fix.coords) ||
      !Number.isFinite(fix.timestamp) ||
      Date.now() - fix.timestamp > 120000 ||
      fix.timestamp > Date.now() + 10000 ||
      fix.coords.accuracy === null ||
      !Number.isFinite(fix.coords.accuracy) ||
      fix.coords.accuracy < 0 ||
      fix.coords.accuracy > 10000
    )
      return { state: "stale" };
    const approximate =
      permission.android?.accuracy === "coarse" || fix.coords.accuracy > 100;
    return {
      state: approximate ? "approximate" : "precise",
      position: {
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
      },
    };
  } catch {
    return { state: "unavailable" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
