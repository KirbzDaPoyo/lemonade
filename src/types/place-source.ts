export type PlaceSourceMediaType = 'post' | 'reel' | 'unknown';

export type PlaceSourceDraft = {
  platform: 'instagram';
  sourceUrl: string;
  shortcode?: string;
  mediaType: PlaceSourceMediaType;
  creatorUsername?: string;
  captionExcerpt?: string;
  recommendedItems: string[];
  vibeTags: string[];
  thumbnailUrl?: string;
  publishedAt?: string;
};

export type PlaceSource = PlaceSourceDraft & {
  id: string;
  savedPlaceId: string;
  createdAt: string;
};
