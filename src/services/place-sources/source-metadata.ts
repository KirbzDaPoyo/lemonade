import type { PlaceExtractionResult } from '../../types/extraction';
import type { InstagramImportResult } from '../../types/instagramImport';
import type { PlaceSourceDraft, PlaceSourceMediaType } from '../../types/place-source';
import { normalizeInstagramSourceUrl } from '../incomingShare/instagramUrl';

export const SOURCE_CAPTION_MAX_LENGTH = 280;
const SOURCE_LIST_MAX_ITEMS = 8;

const cleanText = (value: string | null | undefined, maxLength: number) => {
  const clean = value?.trim().replace(/\s+/g, ' ');
  return clean ? Array.from(clean).slice(0, maxLength).join('') : undefined;
};

const cleanList = (values: string[] | undefined, maxLength: number) => {
  const seen = new Set<string>();

  return (values ?? [])
    .map((value) => cleanText(value, maxLength))
    .filter((value): value is string => {
      if (!value) return false;
      const key = value.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, SOURCE_LIST_MAX_ITEMS);
};

const getMediaType = (
  sourceUrl: string,
  productType?: string,
  rawType?: string
): PlaceSourceMediaType => {
  const providerType = `${productType ?? ''} ${rawType ?? ''}`.toLowerCase();
  if (/reel/.test(providerType) || /\/reel\//i.test(sourceUrl)) return 'reel';
  if (/post|image|carousel/.test(providerType) || /\/p\//i.test(sourceUrl)) return 'post';
  return 'unknown';
};

const cleanHttpsUrl = (value?: string) => {
  const clean = value?.trim();
  if (!clean) return undefined;

  try {
    const url = new URL(clean);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const cleanTimestamp = (value?: string) => {
  if (!value) return undefined;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.valueOf()) ? undefined : timestamp.toISOString();
};

const getShortcode = (sourceUrl: string, providerShortcode?: string) =>
  cleanText(providerShortcode, 100) ??
  sourceUrl.match(/^https:\/\/www\.instagram\.com\/(?:p|reel)\/([^/]+)\/$/i)?.[1];

export const createPlaceSourceDraft = ({
  fallbackUrl,
  instagramImport,
  extraction
}: {
  fallbackUrl: string;
  instagramImport?: InstagramImportResult;
  extraction?: PlaceExtractionResult;
}): PlaceSourceDraft => {
  const sourceUrl = normalizeInstagramSourceUrl(
    instagramImport?.sourceUrl ?? instagramImport?.instagramUrl ?? fallbackUrl
  );

  return {
    platform: 'instagram',
    sourceUrl,
    shortcode: getShortcode(sourceUrl, instagramImport?.shortcode),
    mediaType: getMediaType(
      sourceUrl,
      instagramImport?.productType,
      instagramImport?.rawType
    ),
    creatorUsername: cleanText(instagramImport?.ownerUsername?.replace(/^@+/, ''), 100),
    captionExcerpt: cleanText(instagramImport?.caption, SOURCE_CAPTION_MAX_LENGTH),
    recommendedItems: cleanList(extraction?.recommendedItems, 80),
    vibeTags: cleanList(
      extraction?.vibeTags.filter((tag) => tag !== 'manual-search'),
      40
    ),
    thumbnailUrl: cleanHttpsUrl(instagramImport?.thumbnailUrl),
    publishedAt: cleanTimestamp(instagramImport?.timestamp)
  };
};
