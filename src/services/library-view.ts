import type { PlaceCard } from '../types/place';
import type { PlaceStatusFilter } from '../types/filters';
import { matchesPlacesScreenFilters } from './placeFilters';

export const sortLabels = { newest: 'Newest saved', oldest: 'Oldest saved', updated: 'Recently updated', name: 'Place name A–Z' } as const;
export type LibrarySort = keyof typeof sortLabels;
export type LibraryDensity = 'comfortable' | 'compact';
export type LibraryPreferences = { sort: LibrarySort; density: LibraryDensity };
export type LibraryView = LibraryPreferences & { query: string; status: PlaceStatusFilter; favoritesOnly: boolean; tag: string | null; category: string | null; area: string | null };
export const defaultPreferences: LibraryPreferences = { sort: 'newest', density: 'comfortable' };
export const defaultLibraryView: LibraryView = { ...defaultPreferences, query: '', status: 'all', favoritesOnly: false, tag: null, category: null, area: null };
export const normalizeLibraryText = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/gu, ' ').trim();
export const clearLibraryFilters = (view: LibraryView): LibraryView => ({ ...view, status: 'all', favoritesOnly: false, tag: null, category: null, area: null });
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const timestamp = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
export function libraryOptions(places: readonly PlaceCard[], field: 'category' | 'areaCity') {
  const options = new Map<string, string>();
  for (const place of places) {
    const label = (place[field] ?? '').trim().replace(/\s+/gu, ' ');
    const value = normalizeLibraryText(label);
    if (value && (!options.has(value) || compare(label, options.get(value)!) < 0)) options.set(value, label);
  }
  return [...options].sort(([a], [b]) => compare(a, b)).map(([value, label]) => ({ value, label }));
}
export function selectLibraryPlaces(places: readonly PlaceCard[], view: LibraryView) {
  const tokens = normalizeLibraryText(view.query).split(' ').filter(Boolean);
  return places.filter(place => {
    if (!matchesPlacesScreenFilters(place, view.status, view.tag, view.favoritesOnly)) return false;
    if (view.category && normalizeLibraryText(place.category) !== view.category) return false;
    if (view.area && normalizeLibraryText(place.areaCity) !== view.area) return false;
    if (!tokens.length) return true;
    const content = normalizeLibraryText([place.placeName, place.areaCity, place.address, place.cuisineOrSpecialty, ...place.tags, place.notes,
      ...place.sources.flatMap(source => [source.creatorUsername, Array.from(source.captionExcerpt ?? '').slice(0, 280).join(''), ...source.recommendedItems, ...source.vibeTags])
    ].filter(Boolean).join(' '));
    return tokens.every(token => content.includes(token));
  }).sort((a, b) => {
    const primary = view.sort === 'name' ? compare(normalizeLibraryText(a.placeName), normalizeLibraryText(b.placeName))
      : view.sort === 'oldest' ? timestamp(a.createdAt) - timestamp(b.createdAt)
      : view.sort === 'updated' ? timestamp(b.updatedAt) - timestamp(a.updatedAt)
      : timestamp(b.createdAt) - timestamp(a.createdAt);
    return primary || compare(a.id, b.id);
  });
}
export function parseLibraryPreferences(raw: string | null): LibraryPreferences {
  try {
    const value = JSON.parse(raw ?? 'null');
    return { sort: value && typeof value.sort === 'string' && Object.prototype.hasOwnProperty.call(sortLabels, value.sort) ? value.sort : 'newest', density: value?.density === 'compact' ? 'compact' : 'comfortable' };
  } catch { return { ...defaultPreferences }; }
}
