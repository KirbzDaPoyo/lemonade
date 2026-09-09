import type { PlaceCard, PlaceTag } from '../../types/place';

export const PLACE_DATA_EXPORT_FORMAT = 'project-lemonade-data-export' as const;
export const PLACE_DATA_EXPORT_SCHEMA_VERSION = 2 as const;

export type PlaceDataExport = {
  format: typeof PLACE_DATA_EXPORT_FORMAT;
  schemaVersion: typeof PLACE_DATA_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  data: {
    savedPlaces: Array<{
      id: string;
      name: string;
      address: string;
      areaOrCity: string;
      category: PlaceCard['category'];
      specialty: string | null;
      tags: string[];
      notes: string | null;
      status: PlaceCard['status'];
      favorite: boolean;
      createdAt: string;
      updatedAt: string;
      sourceInstagramUrl: string;
      mapUrl: string | null;
      providerPlaceId: string | null;
      sources: Array<{
        id: string;
        platform: 'instagram';
        sourceUrl: string;
        shortcode: string | null;
        mediaType: 'post' | 'reel' | 'unknown';
        creatorUsername: string | null;
        captionExcerpt: string | null;
        recommendedItems: string[];
        vibeTags: string[];
        thumbnailUrl: string | null;
        publishedAt: string | null;
        createdAt: string;
      }>;
    }>;
    tags: Array<{
      id: string;
      name: string;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

export const createPlaceDataExport = (
  places: PlaceCard[],
  tags: PlaceTag[],
  exportedAt = new Date().toISOString()
): PlaceDataExport => ({
  format: PLACE_DATA_EXPORT_FORMAT,
  schemaVersion: PLACE_DATA_EXPORT_SCHEMA_VERSION,
  exportedAt,
  data: {
    savedPlaces: places
      .map((place) => ({
        id: place.id,
        name: place.placeName,
        address: place.address,
        areaOrCity: place.areaCity,
        category: place.category,
        specialty: place.cuisineOrSpecialty ?? null,
        tags: [...place.tags],
        notes: place.notes ?? null,
        status: place.status,
        favorite: place.isFavorite,
        createdAt: place.createdAt,
        updatedAt: place.updatedAt,
        sourceInstagramUrl: place.sourceInstagramUrl,
        mapUrl: place.mapUrl ?? null,
        providerPlaceId: place.placeId ?? null,
        sources: place.sources.map((source) => ({
          id: source.id,
          platform: source.platform,
          sourceUrl: source.sourceUrl,
          shortcode: source.shortcode ?? null,
          mediaType: source.mediaType,
          creatorUsername: source.creatorUsername ?? null,
          captionExcerpt: source.captionExcerpt ?? null,
          recommendedItems: [...source.recommendedItems],
          vibeTags: [...source.vibeTags],
          thumbnailUrl: source.thumbnailUrl ?? null,
          publishedAt: source.publishedAt ?? null,
          createdAt: source.createdAt
        }))
      }))
      .sort((left, right) =>
        left.createdAt === right.createdAt
          ? left.id.localeCompare(right.id)
          : left.createdAt.localeCompare(right.createdAt)
      ),
    tags: tags
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt
      }))
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
  }
});

export const serializePlaceDataExport = (dataExport: PlaceDataExport) =>
  `${JSON.stringify(dataExport, null, 2)}\n`;
