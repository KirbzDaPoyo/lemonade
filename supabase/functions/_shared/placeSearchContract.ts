export type PlaceCategory =
  | 'cafe'
  | 'restaurant'
  | 'street_food'
  | 'dessert'
  | 'bar'
  | 'market'
  | 'other';

export type GeoRegionCode = 'HK' | 'SG' | string;

export type LocationBiasRectangle = {
  low: {
    latitude: number;
    longitude: number;
  };
  high: {
    latitude: number;
    longitude: number;
  };
};

export type GeoContext = {
  regionCode: GeoRegionCode;
  searchSuffix: string;
  locationBias: LocationBiasRectangle;
};

export type PlaceSearchSourceSignal =
  | 'pin_line'
  | 'raw_handle'
  | 'tagged_user'
  | 'collaborator'
  | 'title_line'
  | 'address_line'
  | 'instagram_location'
  | 'user_hint';

export type PlaceSearchCandidate = {
  query: string;
  reason: string;
  confidence: number;
  parsedPlaceName?: string;
  parsedAddress?: string;
  sourceSignal: PlaceSearchSourceSignal;
};

export type PlaceSearchRequest = {
  query: string;
  searchCandidates?: PlaceSearchCandidate[];
  geoContext?: GeoContext;
};

export type PlaceCandidateProvider = 'mock' | 'google_places';

export type PlaceCandidate = {
  provider: PlaceCandidateProvider;
  providerPlaceId: string;
  name: string;
  address: string;
  areaCity: string;
  category: PlaceCategory;
  cuisineOrSpecialty?: string;
  tags: string[];
  mapUrl?: string;
  latitude?: number;
  longitude?: number;
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  matchedQuery?: string;
  matchScore?: number;
  matchedReason?: string;
  matchedConfidence?: number;
  matchedParsedPlaceName?: string;
  matchedParsedAddress?: string;
  matchedSourceSignal?: PlaceSearchSourceSignal;
};

export type PlaceSearchFunctionResponse = {
  candidates?: PlaceCandidate[];
  error?: {
    code?: string;
    message?: string;
  };
};
