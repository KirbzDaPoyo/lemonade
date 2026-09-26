export const appRoutePaths = {
  home: '/',
  inbox: '/inbox',
  account: '/account',
  addPlace: '/add-place',
  matchPlace: '/match-place'
} as const;

export const getPlaceDetailHref = (placeId: string, logVisit = false) => ({
  pathname: '/place/[placeId]' as const,
  params: { placeId, ...(logVisit ? { logVisit: '1' } : {}) }
});
