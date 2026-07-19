import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

type PlaceCategory =
  | 'cafe'
  | 'restaurant'
  | 'street_food'
  | 'dessert'
  | 'bar'
  | 'market'
  | 'other';

type LocationBiasRectangle = {
  low: { latitude: number; longitude: number };
  high: { latitude: number; longitude: number };
};

type GeoContext = {
  regionCode: string;
  searchSuffix: string;
  locationBias: LocationBiasRectangle;
};

type SearchSourceSignal =
  | 'pin_line'
  | 'raw_handle'
  | 'tagged_user'
  | 'collaborator'
  | 'title_line'
  | 'address_line'
  | 'instagram_location'
  | 'user_hint';

type SearchCandidateInput = {
  query: string;
  reason?: string;
  confidence?: number;
  parsedPlaceName?: string;
  parsedAddress?: string;
  sourceSignal?: SearchSourceSignal;
};

type PlaceSearchRequest = {
  query?: string;
  searchCandidates?: Array<string | SearchCandidateInput>;
  sourceInstagramUrl?: string;
  areaOrCity?: string;
  category?: PlaceCategory;
  cuisineOrSpecialty?: string;
  geoContext?: GeoContext;
};

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  primaryType?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  addressComponents?: GoogleAddressComponent[];
};

type RankedCandidate = ReturnType<typeof mapPlace> & {
  matchedQuery: string;
  matchScore: number;
  matchedReason?: string;
  matchedConfidence?: number;
  matchedParsedPlaceName?: string;
  matchedParsedAddress?: string;
  matchedSourceSignal?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const categoryByPrimaryType: Record<string, PlaceCategory> = {
  bakery: 'dessert',
  bar: 'bar',
  cafe: 'cafe',
  coffee_shop: 'cafe',
  dessert_restaurant: 'dessert',
  food_court: 'market',
  ice_cream_shop: 'dessert',
  market: 'market',
  night_market: 'market',
  restaurant: 'restaurant',
  thai_restaurant: 'restaurant'
};

const defaultGeoContext: GeoContext = {
  regionCode: 'HK',
  searchSuffix: 'Hong Kong',
  locationBias: {
    low: { latitude: 22.13, longitude: 113.82 },
    high: { latitude: 22.57, longitude: 114.43 }
  }
};

const relevantTypes = new Set([
  'restaurant',
  'cafe',
  'bakery',
  'bar',
  'food',
  'food_court',
  'store',
  'meal_takeaway',
  'meal_delivery',
  'dessert_restaurant',
  'coffee_shop'
]);

const weakTerms = new Set([
  'hong',
  'kong',
  'singapore',
  'hk',
  'sg',
  'cafe',
  'coffee',
  'restaurant',
  'ramen',
  'bakery',
  'bar',
  'dessert',
  'food',
  'central',
  'kowloon',
  'causeway',
  'bay',
  'tsim',
  'sha',
  'tsui',
  'sham',
  'shui',
  'po',
  'san'
]);

const sourceBoost: Record<string, number> = {
  instagram_location: 30,
  pin_line: 28,
  tagged_user: 24,
  collaborator: 20,
  raw_handle: 18,
  address_line: 16,
  title_line: 8,
  user_hint: 10
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

const compact = (values: Array<string | undefined>) =>
  values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
const lower = (value: string) => normalize(value).toLowerCase();
const unique = <T>(values: T[], key: (value: T) => string) => {
  const seen = new Set<string>();

  return values.filter((value) => {
    const id = key(value).toLowerCase();

    if (!id || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
};

const hasSuffix = (query: string, suffix: string) => lower(query).includes(lower(suffix));
const withGeoSuffix = (query: string, geoContext: GeoContext) =>
  hasSuffix(query, geoContext.searchSuffix) ? normalize(query) : `${normalize(query)} ${geoContext.searchSuffix}`;

const queryTokens = (value: string) =>
  lower(value)
    .replace(/hong kong|singapore/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);

const hasStrongIdentifier = (candidate: SearchCandidateInput) =>
  Boolean(candidate.parsedPlaceName || candidate.parsedAddress) ||
  ['raw_handle', 'tagged_user', 'collaborator', 'instagram_location'].includes(
    candidate.sourceSignal ?? ''
  );

const isWeakQuery = (candidate: SearchCandidateInput) => {
  if (!hasStrongIdentifier(candidate)) {
    return true;
  }

  return queryTokens(candidate.query).filter((token) => !weakTerms.has(token)).length === 0;
};

const normalizeSearchCandidate = (
  candidate: string | SearchCandidateInput,
  geoContext: GeoContext
): SearchCandidateInput => {
  if (typeof candidate === 'string') {
    return {
      query: withGeoSuffix(candidate, geoContext),
      reason: 'legacy query',
      confidence: 0.5,
      sourceSignal: 'user_hint',
      parsedPlaceName: candidate
    };
  }

  return {
    ...candidate,
    query: withGeoSuffix(candidate.query, geoContext),
    confidence: candidate.confidence ?? 0.5
  };
};

const getSearchCandidates = (input: PlaceSearchRequest, geoContext: GeoContext) => {
  const rawCandidates = input.searchCandidates?.length
    ? input.searchCandidates
    : input.query
      ? [
          {
            query: input.query,
            reason: 'single query',
            confidence: 0.5,
            parsedPlaceName: input.query,
            sourceSignal: 'user_hint' as const
          }
        ]
      : [];
  const normalized = rawCandidates.map((candidate) => normalizeSearchCandidate(candidate, geoContext));
  const accepted = normalized.filter((candidate) => !isWeakQuery(candidate));
  const rejected = normalized.filter(isWeakQuery).map((candidate) => candidate.query);

  console.log('place-search candidates', JSON.stringify({
    accepted: accepted.map((candidate) => ({
      query: candidate.query,
      reason: candidate.reason,
      confidence: candidate.confidence,
      sourceSignal: candidate.sourceSignal
    })),
    rejectedWeakQueries: rejected
  }));

  return unique(accepted, (candidate) => candidate.query).slice(0, 7);
};

const getAddressPart = (place: GooglePlace, types: string[]) =>
  place.addressComponents?.find((component) =>
    types.some((type) => component.types?.includes(type))
  )?.longText;

const deriveAreaOrCity = (place: GooglePlace) =>
  getAddressPart(place, ['locality', 'postal_town']) ??
  getAddressPart(place, ['administrative_area_level_2']) ??
  getAddressPart(place, ['administrative_area_level_1']) ??
  'Area to confirm';

const getCountryCode = (place: GooglePlace) =>
  place.addressComponents?.find((component) => component.types?.includes('country'))?.shortText;

const mapCategory = (primaryType?: string): PlaceCategory => {
  if (!primaryType) {
    return 'other';
  }

  return categoryByPrimaryType[primaryType] ?? 'other';
};

const tokenHits = (needle: string | undefined, haystack: string) => {
  if (!needle) {
    return 0;
  }

  return queryTokens(needle).filter((token) => haystack.includes(token)).length;
};

const scorePlace = (
  place: GooglePlace,
  candidate: SearchCandidateInput,
  geoContext: GeoContext,
  queryIndex: number
) => {
  const name = place.displayName?.text ?? '';
  const address = place.formattedAddress ?? '';
  const primaryType = place.primaryType ?? '';
  const types = [primaryType, ...(place.types ?? [])];
  const nameHaystack = lower(name);
  const addressHaystack = lower(address);
  const allHaystack = lower(`${name} ${address} ${primaryType}`);
  const inRegion = getCountryCode(place) === geoContext.regionCode || address.includes(geoContext.searchSuffix);
  const typeRelevant = types.some((type) => relevantTypes.has(type));

  return (
    Math.max(0, 26 - queryIndex * 3) +
    (candidate.confidence ?? 0.5) * 25 +
    (sourceBoost[candidate.sourceSignal ?? ''] ?? 0) +
    (inRegion ? 45 : -45) +
    tokenHits(candidate.parsedPlaceName, nameHaystack) * 20 +
    tokenHits(candidate.parsedAddress, addressHaystack) * 10 +
    tokenHits(candidate.query, allHaystack) * 8 +
    (typeRelevant ? 15 : 0) +
    (place.googleMapsUri ? 8 : 0) +
    (place.id ? 8 : 0) +
    (place.rating ? Math.min(place.rating, 5) : 0)
  );
};

function mapPlace(place: GooglePlace) {
  const primaryType = place.primaryType;
  const areaCity = deriveAreaOrCity(place);

  return {
    provider: 'google_places',
    providerPlaceId: place.id ?? '',
    place_id: place.id ?? '',
    name: place.displayName?.text ?? 'Unnamed place',
    address: place.formattedAddress ?? 'Address to confirm',
    formatted_address: place.formattedAddress ?? undefined,
    areaCity,
    area_or_city: areaCity,
    category: mapCategory(primaryType),
    cuisineOrSpecialty: primaryType?.replaceAll('_', ' '),
    tags: compact([primaryType?.replaceAll('_', '-')]),
    mapUrl: place.googleMapsUri,
    google_maps_uri: place.googleMapsUri,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    primaryType,
    userRatingCount: place.userRatingCount,
    primary_type: primaryType,
    rating: place.rating,
    user_rating_count: place.userRatingCount
  };
}

const searchGooglePlaces = async (
  apiKey: string,
  candidate: SearchCandidateInput,
  geoContext: GeoContext,
  useRestriction: boolean
) => {
  const placeBias = useRestriction
    ? { locationRestriction: { rectangle: geoContext.locationBias } }
    : { locationBias: { rectangle: geoContext.locationBias } };

  const googleResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.addressComponents',
        'places.location',
        'places.googleMapsUri',
        'places.primaryType',
        'places.types',
        'places.rating',
        'places.userRatingCount'
      ].join(',')
    },
    body: JSON.stringify({
      textQuery: candidate.query,
      maxResultCount: 8,
      regionCode: geoContext.regionCode,
      languageCode: 'en',
      ...placeBias
    })
  });

  const googlePayload = await googleResponse.json().catch(() => ({}));

  if (!googleResponse.ok) {
    throw new Error(
      googlePayload?.error?.message ??
        'Google Places search failed. Check API key, billing, and Places API access.'
    );
  }

  return (googlePayload.places ?? []) as GooglePlace[];
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for place search.' } },
      405
    );
  }

  const googlePlacesApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

  if (!googlePlacesApiKey) {
    return jsonResponse({
      candidates: [],
      error: {
        code: 'GOOGLE_PLACES_API_KEY_MISSING',
        message: 'Google Places API key is not configured for this Supabase project.'
      }
    });
  }

  const input = (await req.json().catch(() => ({}))) as PlaceSearchRequest;
  const geoContext = input.geoContext ?? defaultGeoContext;
  const searchCandidates = getSearchCandidates(input, geoContext);

  if (!searchCandidates.length) {
    return jsonResponse({
      candidates: [],
      error: { code: 'EMPTY_QUERY', message: 'Enter a place name before searching.' }
    }, 400);
  }

  const useRestriction = Deno.env.get('GOOGLE_PLACES_USE_LOCATION_RESTRICTION') === 'true';
  const deduped = new Map<string, RankedCandidate>();

  try {
    for (const [queryIndex, candidateInput] of searchCandidates.entries()) {
      const places = await searchGooglePlaces(
        googlePlacesApiKey,
        candidateInput,
        geoContext,
        useRestriction
      );

      for (const place of places) {
        const key = place.id ?? `${place.displayName?.text}-${place.formattedAddress}`;
        const candidate = {
          ...mapPlace(place),
          matchedQuery: candidateInput.query,
          matchScore: scorePlace(place, candidateInput, geoContext, queryIndex),
          matchedReason: candidateInput.reason,
          matchedConfidence: candidateInput.confidence,
          matchedParsedPlaceName: candidateInput.parsedPlaceName,
          matchedParsedAddress: candidateInput.parsedAddress,
          matchedSourceSignal: candidateInput.sourceSignal
        };
        const existing = deduped.get(key);

        if (!existing || candidate.matchScore > existing.matchScore) {
          deduped.set(key, candidate);
        }
      }
    }
  } catch (error) {
    return jsonResponse(
      {
        candidates: [],
        error: {
          code: 'GOOGLE_PLACES_REQUEST_FAILED',
          message:
            error instanceof Error
              ? error.message
              : 'Google Places search failed. Check API key, billing, and Places API access.'
        }
      },
      502
    );
  }

  const candidates = Array.from(deduped.values())
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, 12);

  return jsonResponse({ candidates });
});