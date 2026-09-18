import { validPosition, type Position } from "./map-library";
import type { LocationResult } from "../../supabase/functions/_shared/placeLocations";
const failures = [
  "unavailable",
  "invalid",
  "moved",
  "timeout",
  "provider",
  "configuration",
  "user_quota",
  "project_quota",
  "quota",
  "authentication",
  "network",
];
export class MapSession {
  private generation = 0;
  private cache = new Map<string, Position>();
  private pending = new Map<string, Promise<LocationResult[]>>();
  clear() {
    this.generation++;
    this.cache.clear();
    this.pending.clear();
  }
  async resolve(
    places: readonly { id: string; placeId?: string }[],
    request: (ids: string[]) => Promise<LocationResult[]>,
    refresh = false,
  ) {
    if (
      !places.length ||
      places.length > 20 ||
      places.some((p) => !p.id.trim() || !p.placeId?.trim()) ||
      new Set(places.map((p) => p.id)).size !== places.length
    )
      throw new Error("invalid");
    const identities = places.map((p) => JSON.stringify([p.id, p.placeId]));
    const key = JSON.stringify([...identities].sort());
    if (this.pending.has(key)) return this.pending.get(key)!;
    const generation = this.generation;
    const missing = places.filter(
      (_, i) => refresh || !this.cache.has(identities[i]),
    );
    const work = (async () => {
      const results = missing.length
        ? await request(missing.map((p) => p.id))
        : [];
      if (generation !== this.generation) throw new Error("authentication");
      if (!Array.isArray(results) || results.length > missing.length)
        throw new Error("invalid");
      // Validate the entire response before mutating session state.
      const received = new Set<string>();
      for (const result of results) {
        if (
          !result ||
          typeof result.id !== "string" ||
          received.has(result.id) ||
          !missing.some((p) => p.id === result.id)
        )
          throw new Error("invalid");
        received.add(result.id);
        if ("latitude" in result) {
          if (!validPosition(result) || "failure" in result)
            throw new Error("invalid");
        } else if (!failures.includes(result.failure))
          throw new Error("invalid");
      }
      for (const p of missing) {
        const index = places.findIndex((item) => item.id === p.id);
        const result = results.find((item) => item.id === p.id);
        if (result && "latitude" in result)
          this.cache.set(identities[index], {
            latitude: result.latitude,
            longitude: result.longitude,
          });
        else this.cache.delete(identities[index]);
      }
      return places.map((p, i): LocationResult => {
        const failure = results.find((r) => r.id === p.id && "failure" in r);
        if (failure) return failure;
        const position = this.cache.get(identities[i]);
        return position
          ? { id: p.id, ...position }
          : { id: p.id, failure: "unavailable" };
      });
    })();
    this.pending.set(key, work);
    try {
      return await work;
    } finally {
      if (this.pending.get(key) === work) this.pending.delete(key);
    }
  }
}
export function mockPositions(ids: string[]): Promise<LocationResult[]> {
  return Promise.resolve(
    ids.map((id) => {
      const hash = Array.from(id).reduce(
        (sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0,
        0,
      );
      return {
        id,
        latitude: 25.033 + (hash % 20) * 0.003,
        longitude: 121.565 + ((hash >>> 5) % 20) * 0.002,
      };
    }),
  );
}
