export type RawInstagramImportResult = {
  sourceUrl: string;
  inputUrl: string;
  shortcode?: string;
  caption?: string;
  hashtags: string[];
  mentions: string[];
  taggedUsers: string[];
  collaborators: string[];
  locationName?: string;
  locationAddress?: string;
  locationCity?: string;
  locationCountry?: string;
  locationLat?: number;
  locationLng?: number;
  ownerUsername?: string;
  ownerFullName?: string;
  timestamp?: string;
  thumbnailUrl?: string;
  instagramUrl?: string;
  productType?: string;
  rawType?: string;
};

export type InstagramImportResult = RawInstagramImportResult;
