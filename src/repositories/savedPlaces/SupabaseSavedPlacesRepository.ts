import type { SupabaseClient } from '@supabase/supabase-js';

import {
  PlaceTagRow,
  SavedPlaceRow,
  SavedPlaceSourceRow
} from '../../lib/supabaseClient';
import type { PlaceCard, PlaceSource, PlaceTag } from '../../types/place';
import type { PlaceSourceDraft } from '../../types/place-source';
import { normalizeInstagramSourceUrl } from './placeIdentity';
import {
  NewPlace,
  PlaceSaveOutcome,
  PlaceUpdate,
  SavedPlacesRepository
} from './types';

const safeStringArray = (value: string[] | null | undefined) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];

export const mapSourceRow = (row: SavedPlaceSourceRow): PlaceSource => ({
  id: row.id,
  savedPlaceId: row.saved_place_id,
  platform: 'instagram',
  sourceUrl: normalizeInstagramSourceUrl(row.source_url),
  shortcode: row.shortcode ?? undefined,
  mediaType:
    row.media_type === 'post' || row.media_type === 'reel'
      ? row.media_type
      : 'unknown',
  creatorUsername: row.creator_username ?? undefined,
  captionExcerpt: row.caption_excerpt ?? undefined,
  recommendedItems: safeStringArray(row.recommended_items),
  vibeTags: safeStringArray(row.vibe_tags),
  thumbnailUrl: row.thumbnail_url ?? undefined,
  publishedAt: row.published_at ?? undefined,
  createdAt: row.created_at
});

export const mapRowToPlace = (
  row: SavedPlaceRow,
  sources: PlaceSource[] = []
): PlaceCard => ({
  id: row.id,
  placeName: row.name,
  address: row.address,
  areaCity: row.area_or_city,
  category: row.category,
  cuisineOrSpecialty: row.cuisine_or_specialty ?? undefined,
  tags: row.user_tags ?? row.tags ?? [],
  notes: row.notes ?? undefined,
  sourceInstagramUrl: row.source_url,
  sources,
  placeId: row.place_id ?? undefined,
  mapUrl: row.map_url ?? undefined,
  status: row.status,
  isFavorite: row.is_favorite,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

type SavedPlaceInsert = Omit<SavedPlaceRow, 'created_at' | 'updated_at'>;
export const mapTagRow = (row: PlaceTagRow): PlaceTag => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const mapPlaceToRow = (place: NewPlace, userId: string): SavedPlaceInsert => ({
  user_id: userId,
  id: place.id,
  name: place.placeName,
  address: place.address,
  area_or_city: place.areaCity,
  category: place.category,
  cuisine_or_specialty: place.cuisineOrSpecialty ?? null,
  tags: [],
  user_tags: place.tags,
  notes: place.notes ?? null,
  source_url: normalizeInstagramSourceUrl(place.sourceInstagramUrl),
  place_id: place.placeId ?? null,
  map_url: place.mapUrl ?? null,
  status: place.status,
  is_favorite: place.isFavorite
});

export const mapPlaceUpdateToRow = (updates: PlaceUpdate): Partial<SavedPlaceRow> => ({
  ...(updates.placeName !== undefined ? { name: updates.placeName } : {}),
  ...(updates.address !== undefined ? { address: updates.address } : {}),
  ...(updates.areaCity !== undefined ? { area_or_city: updates.areaCity } : {}),
  ...(updates.category !== undefined ? { category: updates.category } : {}),
  ...(updates.cuisineOrSpecialty !== undefined
    ? { cuisine_or_specialty: updates.cuisineOrSpecialty ?? null }
    : {}),
  ...(updates.tags !== undefined ? { user_tags: updates.tags } : {}),
  ...(updates.notes !== undefined ? { notes: updates.notes ?? null } : {}),
  ...(updates.sourceInstagramUrl !== undefined
    ? { source_url: normalizeInstagramSourceUrl(updates.sourceInstagramUrl) }
    : {}),
  ...(updates.placeId !== undefined ? { place_id: updates.placeId ?? null } : {}),
  ...(updates.mapUrl !== undefined ? { map_url: updates.mapUrl ?? null } : {}),
  ...(updates.status !== undefined ? { status: updates.status } : {}),
  ...(updates.isFavorite !== undefined ? { is_favorite: updates.isFavorite } : {})
});

const toSupabaseError = (action: string, message?: string) =>
  new Error(`Supabase saved places ${action} failed${message ? `: ${message}` : '.'}`);

export const shouldReplaceIncompleteManualPlace = (
  existingPlace: PlaceCard,
  replacement: NewPlace
) =>
  !existingPlace.placeId &&
  existingPlace.address === 'Address to confirm' &&
  Boolean(replacement.placeId);

const fallbackSource = (place: NewPlace): PlaceSourceDraft => ({
  platform: 'instagram',
  sourceUrl: normalizeInstagramSourceUrl(place.sourceInstagramUrl),
  mediaType: /\/p\//i.test(place.sourceInstagramUrl)
    ? 'post'
    : /\/reels?\//i.test(place.sourceInstagramUrl)
      ? 'reel'
      : 'unknown',
  recommendedItems: [],
  vibeTags: []
});

const isSaveOutcome = (value: unknown): value is PlaceSaveOutcome =>
  value === 'created_place' ||
  value === 'attached_source' ||
  value === 'existing_source';

export class SupabaseSavedPlacesRepository implements SavedPlacesRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly userId: string
  ) {}

  async listSources(savedPlaceId?: string) {
    let query = this.supabase
      .from('saved_place_sources')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (savedPlaceId) {
      query = query.eq('saved_place_id', savedPlaceId);
    }

    const { data, error } = await query;

    if (error) {
      throw toSupabaseError('source read', error.message);
    }

    return (data ?? []).map((row) => mapSourceRow(row as SavedPlaceSourceRow));
  }

  async listPlaces() {
    const [placesResult, sources] = await Promise.all([
      this.supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false }),
      this.listSources()
    ]);
    const { data, error } = placesResult;

    if (error) {
      throw toSupabaseError('read', error.message);
    }

    const sourcesByPlace = new Map<string, PlaceSource[]>();
    sources.forEach((source) => {
      const existing = sourcesByPlace.get(source.savedPlaceId) ?? [];
      existing.push(source);
      sourcesByPlace.set(source.savedPlaceId, existing);
    });

    return (data ?? []).map((row) =>
      mapRowToPlace(row as SavedPlaceRow, sourcesByPlace.get(row.id) ?? [])
    );
  }

  private async getPlace(id: string) {
    const [placeResult, sources] = await Promise.all([
      this.supabase
        .from('saved_places')
        .select('*')
        .eq('id', id)
        .eq('user_id', this.userId)
        .single(),
      this.listSources(id)
    ]);

    if (placeResult.error || !placeResult.data) {
      throw toSupabaseError('read saved result', placeResult.error?.message);
    }

    return mapRowToPlace(placeResult.data as SavedPlaceRow, sources);
  }

  async getExportData() {
    const [places, tags] = await Promise.all([this.listPlaces(), this.listTags()]);

    return { places, tags };
  }

  async listTags() {
    const { data, error } = await this.supabase
      .from('place_tags')
      .select('*')
      .eq('user_id', this.userId)
      .order('name', { ascending: true });

    if (error) {
      throw toSupabaseError('tag read', error.message);
    }

    return (data ?? []).map(mapTagRow);
  }

  async createTag(name: string) {
    const { data, error } = await this.supabase
      .from('place_tags')
      .insert({ name, user_id: this.userId })
      .select()
      .single();

    if (error) {
      throw toSupabaseError('tag create', error.message);
    }

    if (!data) {
      throw toSupabaseError('tag create');
    }

    return mapTagRow(data);
  }

  async renameTag(id: string, name: string) {
    const { error } = await this.supabase.rpc('rename_place_tag', {
      p_tag_id: id,
      p_name: name
    });

    if (error) {
      throw toSupabaseError('tag rename', error.message);
    }
  }

  async deleteTag(id: string) {
    const { error } = await this.supabase.rpc('delete_place_tag', {
      p_tag_id: id
    });

    if (error) {
      throw toSupabaseError('tag delete', error.message);
    }
  }

  async savePlace(place: NewPlace) {
    const source = {
      ...fallbackSource(place),
      ...place.source,
      sourceUrl: normalizeInstagramSourceUrl(
        place.source?.sourceUrl ?? place.sourceInstagramUrl
      )
    };
    const { data, error } = await this.supabase.rpc('save_place_with_source', {
      p_place: {
        id: place.id,
        name: place.placeName,
        address: place.address,
        areaOrCity: place.areaCity,
        category: place.category,
        specialty: place.cuisineOrSpecialty ?? null,
        tags: place.tags,
        notes: place.notes ?? null,
        providerPlaceId: place.placeId ?? null,
        mapUrl: place.mapUrl ?? null,
        status: place.status,
        favorite: place.isFavorite
      },
      p_source: source
    });

    if (error) {
      throw toSupabaseError('source-aware save', error.message);
    }

    const resultRow = (Array.isArray(data) ? data[0] : data) as
      | { save_outcome?: unknown; saved_place_id?: unknown }
      | null;

    if (
      !resultRow ||
      !isSaveOutcome(resultRow.save_outcome) ||
      typeof resultRow.saved_place_id !== 'string'
    ) {
      throw toSupabaseError('source-aware save', 'invalid result');
    }

    return {
      outcome: resultRow.save_outcome,
      place: await this.getPlace(resultRow.saved_place_id)
    };
  }

  async createPlace(place: NewPlace) {
    return (await this.savePlace(place)).place;
  }
  async updatePlace(id: string, updates: PlaceUpdate) {
    const { data, error } = await this.supabase
      .from('saved_places')
      .update(mapPlaceUpdateToRow(updates))
      .eq('id', id)
      .eq('user_id', this.userId)
      .select()
      .single();

    if (error) {
      throw toSupabaseError('update', error.message);
    }

    if (!data) {
      throw toSupabaseError('update');
    }

    const sources = await this.listSources(id);
    return mapRowToPlace(data as SavedPlaceRow, sources);
  }

  async deletePlace(id: string) {
    const { error } = await this.supabase
      .from('saved_places')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId);

    if (error) {
      throw toSupabaseError('delete', error.message);
    }
  }
}
