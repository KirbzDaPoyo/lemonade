import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

type UnknownRecord = Record<string, unknown>;

type ApifyInstagramItem = {
  inputUrl?: string;
  url?: string;
  shortCode?: string;
  shortcode?: string;
  caption?: string;
  hashtags?: unknown;
  mentions?: unknown;
  ownerUsername?: string;
  ownerFullName?: string;
  timestamp?: string;
  displayUrl?: string;
  thumbnailUrl?: string;
  productType?: string;
  type?: string;
  taggedUsers?: unknown;
  tagged_users?: unknown;
  collaborators?: unknown;
  coauthors?: unknown;
  coauthorProducers?: unknown;
  coAuthorProducers?: unknown;
  location?: unknown;
  locationName?: string;
  location_name?: string;
  locationAddress?: string;
  location_address?: string;
  locationCity?: string;
  location_city?: string;
  locationCountry?: string;
  location_country?: string;
  locationLat?: unknown;
  location_lat?: unknown;
  locationLng?: unknown;
  location_lng?: unknown;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });

const isInstagramUrl = (url: URL) =>
  url.protocol === 'https:' &&
  (url.hostname === 'instagram.com' || url.hostname === 'www.instagram.com') &&
  (/^\/p\/[^/]+\/?$/i.test(url.pathname) ||
    /^\/reel\/[^/]+\/?$/i.test(url.pathname) ||
    /^\/reels\/[^/]+\/?$/i.test(url.pathname));

const normalizeInstagramUrl = (value: string) => {
  const url = new URL(value);

  if (!isInstagramUrl(url)) {
    throw new Error('Enter a public Instagram post or reel URL.');
  }

  return `${url.origin}${url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`}`;
};

const getResultsType = (url: string) =>
  /\/reels?\//i.test(new URL(url).pathname) ? 'reels' : 'posts';

const asString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const asNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item === 'string') {
            return item.trim();
          }

          const record = asRecord(item);
          return (
            asString(record?.username) ??
            asString(record?.userName) ??
            asString(record?.name) ??
            asString(record?.fullName) ??
            asString(record?.full_name)
          );
        })
        .filter((item): item is string => Boolean(item))
    : [];

const unique = (values: string[]) => Array.from(new Set(values));

const mergeUserArrays = (...values: unknown[]) => unique(values.flatMap(asStringArray));

const getLocationValue = (
  item: ApifyInstagramItem,
  location: UnknownRecord | undefined,
  camelKey: keyof ApifyInstagramItem,
  snakeKey: keyof ApifyInstagramItem,
  locationKeys: string[]
) => {
  const direct = asString(item[camelKey]) ?? asString(item[snakeKey]);

  if (direct) {
    return direct;
  }

  return locationKeys.map((key) => asString(location?.[key])).find(Boolean);
};

const getLocationNumber = (
  item: ApifyInstagramItem,
  location: UnknownRecord | undefined,
  camelKey: keyof ApifyInstagramItem,
  snakeKey: keyof ApifyInstagramItem,
  locationKeys: string[]
) => {
  const direct = asNumber(item[camelKey]) ?? asNumber(item[snakeKey]);

  if (direct !== undefined) {
    return direct;
  }

  return locationKeys.map((key) => asNumber(location?.[key])).find((value) => value !== undefined);
};

const normalizeItem = (item: ApifyInstagramItem, sourceUrl: string, inputUrl: string) => {
  const location = asRecord(item.location);
  const normalized = {
    sourceUrl,
    inputUrl,
    shortcode: item.shortCode ?? item.shortcode,
    caption: item.caption,
    hashtags: asStringArray(item.hashtags),
    mentions: asStringArray(item.mentions),
    taggedUsers: mergeUserArrays(item.taggedUsers, item.tagged_users),
    collaborators: mergeUserArrays(
      item.collaborators,
      item.coauthors,
      item.coauthorProducers,
      item.coAuthorProducers
    ),
    locationName: getLocationValue(item, location, 'locationName', 'location_name', [
      'name',
      'locationName',
      'title'
    ]),
    locationAddress: getLocationValue(item, location, 'locationAddress', 'location_address', [
      'address',
      'locationAddress'
    ]),
    locationCity: getLocationValue(item, location, 'locationCity', 'location_city', [
      'city',
      'locationCity'
    ]),
    locationCountry: getLocationValue(item, location, 'locationCountry', 'location_country', [
      'country',
      'locationCountry'
    ]),
    locationLat: getLocationNumber(item, location, 'locationLat', 'location_lat', [
      'lat',
      'latitude'
    ]),
    locationLng: getLocationNumber(item, location, 'locationLng', 'location_lng', [
      'lng',
      'longitude'
    ]),
    ownerUsername: item.ownerUsername,
    ownerFullName: item.ownerFullName,
    timestamp: item.timestamp,
    thumbnailUrl: item.thumbnailUrl ?? item.displayUrl,
    instagramUrl: item.url ?? sourceUrl,
    productType: item.productType,
    rawType: item.type
  };

  console.log(
    'instagram-import normalized',
    JSON.stringify({
      caption: normalized.caption?.trim() ? 'present' : 'empty',
      hashtags: normalized.hashtags,
      mentions: normalized.mentions,
      taggedUsers: normalized.taggedUsers,
      collaborators: normalized.collaborators,
      location: {
        name: normalized.locationName,
        address: normalized.locationAddress,
        city: normalized.locationCity,
        country: normalized.locationCountry,
        lat: normalized.locationLat,
        lng: normalized.locationLng
      }
    })
  );

  return normalized;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for Instagram import.' } },
      405
    );
  }

  const body = (await req.json().catch(() => ({}))) as { url?: string };

  if (!body.url) {
    return jsonResponse(
      { error: { code: 'INVALID_URL', message: 'Instagram URL is required.' } },
      400
    );
  }

  let normalizedUrl: string;

  try {
    normalizedUrl = normalizeInstagramUrl(body.url);
  } catch (error) {
    return jsonResponse(
      {
        error: {
          code: 'INVALID_URL',
          message: error instanceof Error ? error.message : 'Invalid Instagram URL.'
        }
      },
      400
    );
  }

  const apifyToken = Deno.env.get('APIFY_API_TOKEN');

  if (!apifyToken) {
    return jsonResponse(
      {
        error: {
          code: 'APIFY_API_TOKEN_MISSING',
          message: 'Apify API token is not configured for this Supabase project.'
        }
      },
      500
    );
  }

  const requestUrl = new URL(
    'https://api.apify.com/v2/actors/apify~instagram-scraper/run-sync-get-dataset-items'
  );
  requestUrl.searchParams.set('token', apifyToken);
  requestUrl.searchParams.set('format', 'json');
  requestUrl.searchParams.set('clean', 'true');
  requestUrl.searchParams.set('limit', '1');

  const apifyResponse = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      resultsType: getResultsType(normalizedUrl),
      directUrls: [normalizedUrl],
      resultsLimit: 1,
      addParentData: false
    })
  });

  const apifyPayload = await apifyResponse.json().catch(() => undefined);

  if (!apifyResponse.ok) {
    return jsonResponse(
      {
        error: {
          code: 'APIFY_REQUEST_FAILED',
          message:
            apifyPayload?.error?.message ??
            'Apify Instagram import failed. Check the token and public URL.'
        }
      },
      502
    );
  }

  const firstItem = Array.isArray(apifyPayload) ? apifyPayload[0] : undefined;

  if (!firstItem) {
    return jsonResponse(
      {
        error: {
          code: 'APIFY_EMPTY_RESULT',
          message: 'Apify returned no metadata for this public Instagram URL.'
        }
      },
      404
    );
  }

  return jsonResponse({
    data: normalizeItem(firstItem as ApifyInstagramItem, normalizedUrl, body.url)
  });
});
