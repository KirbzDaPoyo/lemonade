import { mockPlaceCandidates } from '../../data/mockPlaces';
import { PlaceCandidate } from '../../types/place';
import { PlaceSearchQuery, PlaceSearchService } from './types';

const normalize = (value: string) => value.trim().toLowerCase();

const scoreCandidate = (candidate: PlaceCandidate, query: string) => {
  const haystack = [
    candidate.name,
    candidate.address,
    candidate.areaCity,
    candidate.category,
    candidate.cuisineOrSpecialty,
    candidate.tags.join(' ')
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!query) {
    return 0;
  }

  if (candidate.name.toLowerCase() === query) {
    return 100;
  }

  if (candidate.name.toLowerCase().includes(query)) {
    return 80;
  }

  return query
    .split(/\s+/)
    .filter((token) => token.length > 1 && haystack.includes(token)).length;
};

const buildTypedFallback = (query: string): PlaceCandidate => ({
  provider: 'mock',
  providerPlaceId: `mock-typed-${Date.now()}`,
  name: query,
  address: 'Address to confirm',
  areaCity: 'City to confirm',
  category: 'other',
  cuisineOrSpecialty: undefined,
  tags: ['needs-confirmation'],
  mapUrl: undefined
});

export const mockPlaceSearchService: PlaceSearchService = {
  async searchPlaces({ query, searchCandidates }: PlaceSearchQuery) {
    const primaryQuery = searchCandidates?.[0]?.query ?? query;
    const normalizedQuery = normalize(primaryQuery);

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });

    const rankedCandidates = mockPlaceCandidates
      .map((candidate) => ({
        candidate,
        score: scoreCandidate(candidate, normalizedQuery)
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .map(({ candidate }) => candidate);

    if (rankedCandidates.length > 0) {
      return rankedCandidates.slice(0, 5);
    }

    return normalizedQuery ? [buildTypedFallback(primaryQuery.trim())] : [];
  }
};
