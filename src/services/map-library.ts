import type { PlaceCard } from "../types/place";
import { selectLibraryPlaces, type LibraryView } from "./library-view";
export type Position = { latitude: number; longitude: number };
export const validPosition = (p: unknown): p is Position => {
  const v = p as Position | null;
  return (
    !!v &&
    Number.isFinite(v.latitude) &&
    Number.isFinite(v.longitude) &&
    Math.abs(v.latitude) <= 90 &&
    Math.abs(v.longitude) <= 180
  );
};
export function distanceKm(a: Position, b: Position) {
  if (!validPosition(a) || !validPosition(b))
    throw new Error("Invalid position");
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export const formatDistance = (km: number) =>
  !Number.isFinite(km) || km < 0
    ? ""
    : km < 1
      ? `about ${Math.max(100, Math.round(km * 10) * 100)} m`
      : `about ${km.toFixed(1)} km`;
export function mapScope(places: readonly PlaceCard[], view: LibraryView) {
  const matching = selectLibraryPlaces(places, view);
  const eligible = matching.filter((p) => p.placeId?.trim());
  return {
    eligible,
    unmappable: matching.length - eligible.length,
    valid: eligible.length > 0 && eligible.length <= 20,
    key: JSON.stringify(
      eligible
        .map((p) => [p.id, p.placeId])
        .sort(([a], [b]) => a!.localeCompare(b!)),
    ),
  };
}
export function nearbyPlaces(
  places: readonly PlaceCard[],
  positions: ReadonlyMap<string, Position>,
  origin?: Position,
  radius?: number,
) {
  return places
    .flatMap((place) => {
      const position = positions.get(place.id);
      if (!position) return [];
      const distance = origin ? distanceKm(origin, position) : undefined;
      return radius !== undefined && distance !== undefined && distance > radius
        ? []
        : [{ place, position, distance }];
    })
    .sort(
      (a, b) =>
        (a.distance ?? 0) - (b.distance ?? 0) ||
        (a.place.id < b.place.id ? -1 : a.place.id > b.place.id ? 1 : 0),
    );
}
