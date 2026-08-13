export const appRoutePaths = {
  home: '/',
  account: '/account',
  addPlace: '/add-place',
  matchPlace: '/match-place'
} as const;

export const getPlaceDetailHref = (placeId: string) => ({
  pathname: '/place/[placeId]' as const,
  params: { placeId }
});
