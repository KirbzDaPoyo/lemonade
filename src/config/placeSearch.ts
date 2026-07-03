export type PlaceSearchProviderName = 'mock' | 'google';

const requestedProvider = process.env.EXPO_PUBLIC_PLACE_SEARCH_PROVIDER;

export const placeSearchConfig = {
  requestedProvider,
  provider: resolvePlaceSearchProvider()
};

function resolvePlaceSearchProvider(): PlaceSearchProviderName {
  return requestedProvider === 'google' ? 'google' : 'mock';
}
