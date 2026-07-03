import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

type PlaceCategory =
  | 'cafe'
  | 'restaurant'
  | 'street_food'
  | 'dessert'
  | 'bar'
  | 'market'
  | 'other';

type PlaceSearchRequest = {
  query?: string;
  sourceInstagramUrl?: string;
  areaOrCity?: string;
  category?: PlaceCategory;
  cuisineOrSpecialty?: string;
};

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlace = {
  id?: string;
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  googleMapsUri?: string;
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  addressComponents?: GoogleAddressComponent[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const categoryTerms: Record<PlaceCategory, string> = {
  cafe: 'cafe',
  restaurant: 'restaurant',
  street_food: 'street food',
  dessert: 'dessert',
  bar: 'bar',
  market: 'market',
  other: ''
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

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });

const compact = (values: Array<string | undefined>) =>
  values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));

const buildTextQuery = (input: PlaceSearchRequest) =>
  compact([
    input.query,
    input.areaOrCity,
    input.category && input.category !== 'other'
      ? categoryTerms[input.category]
      : undefined,
    input.cuisineOrSpecialty
  ]).join(' ');

const getAddressPart = (place: GooglePlace, types: string[]) =>
  place.addressComponents?.find((component) =>
    types.some((type) => component.types?.includes(type))
  )?.longText;

const deriveAreaOrCity = (place: GooglePlace) =>
  getAddressPart(place, ['locality', 'postal_town']) ??
  getAddressPart(place, ['administrative_area_level_2']) ??
  getAddressPart(place, ['administrative_area_level_1']) ??
  'Area to confirm';

const mapCategory = (primaryType?: string): PlaceCategory => {
  if (!primaryType) {
    return 'other';
  }

  return categoryByPrimaryType[primaryType] ?? 'other';
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
  const textQuery = buildTextQuery(input);

  if (!textQuery) {
    return jsonResponse({
      candidates: [],
      error: { code: 'EMPTY_QUERY', message: 'Enter a place name before searching.' }
    }, 400);
  }

  const googleResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': googlePlacesApiKey,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.addressComponents',
        'places.location',
        'places.googleMapsUri',
        'places.primaryType',
        'places.rating',
        'places.userRatingCount'
      ].join(',')
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: 8
    })
  });

  const googlePayload = await googleResponse.json().catch(() => ({}));

  if (!googleResponse.ok) {
    return jsonResponse(
      {
        candidates: [],
        error: {
          code: 'GOOGLE_PLACES_REQUEST_FAILED',
          message:
            googlePayload?.error?.message ??
            'Google Places search failed. Check API key, billing, and Places API access.'
        }
      },
      502
    );
  }

  const candidates = ((googlePayload.places ?? []) as GooglePlace[]).map((place) => {
    const primaryType = place.primaryType;

    return {
      provider: 'google_places',
      providerPlaceId: place.id ?? '',
      place_id: place.id ?? '',
      name: place.displayName?.text ?? 'Unnamed place',
      address: place.formattedAddress ?? 'Address to confirm',
      formatted_address: place.formattedAddress ?? undefined,
      areaCity: deriveAreaOrCity(place),
      area_or_city: deriveAreaOrCity(place),
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
  });

  return jsonResponse({ candidates });
});
