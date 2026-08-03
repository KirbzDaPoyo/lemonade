import type { PlaceCard, PlaceTag } from '../types/place';
import type { PlaceStatusFilter } from '../types/filters';
import { getUserTagKey } from './tags/user-tags';

export const matchesStatusFilter = (place: PlaceCard, filter: PlaceStatusFilter) => {
  if (filter === 'all') {
    return true;
  }

  return filter === 'favorite' ? place.isFavorite : place.status === filter;
};

export const getAssignedTagFilterOptions = (places: PlaceCard[], tags: PlaceTag[]) => {
  const assignedTagKeys = new Set<string>();

  for (const place of places) {
    for (const tag of place.tags) {
      assignedTagKeys.add(getUserTagKey(tag));
    }
  }

  return tags.filter((tag) => assignedTagKeys.has(getUserTagKey(tag.name)));
};

export const matchesTagFilter = (place: PlaceCard, tagName: string | null) => {
  if (tagName === null) {
    return true;
  }

  const selectedTagKey = getUserTagKey(tagName);
  return place.tags.some((tag) => getUserTagKey(tag) === selectedTagKey);
};

export const matchesPlacesScreenFilters = (
  place: PlaceCard,
  statusFilter: PlaceStatusFilter,
  tagName: string | null
) => matchesStatusFilter(place, statusFilter) && matchesTagFilter(place, tagName);
