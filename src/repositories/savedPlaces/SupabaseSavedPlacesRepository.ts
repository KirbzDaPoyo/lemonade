import type { SupabaseClient } from '@supabase/supabase-js';

import { PlaceTagRow, SavedPlaceRow } from '../../lib/supabaseClient';
import { PlaceCard, PlaceTag } from '../../types/place';
import { normalizeInstagramSourceUrl } from './placeIdentity';
import { NewPlace, PlaceUpdate, SavedPlacesRepository } from './types';

export const mapRowToPlace = (row: SavedPlaceRow): PlaceCard => ({
  id: row.id,
  placeName: row.name,
  address: row.address,
  areaCity: row.area_or_city,
  category: row.category,
  cuisineOrSpecialty: row.cuisine_or_specialty ?? undefined,
  tags: row.user_tags ?? row.tags ?? [],
  notes: row.notes ?? undefined,
  sourceInstagramUrl: row.source_url,
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

export class SupabaseSavedPlacesRepository implements SavedPlacesRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly userId: string
  ) {}

  private async findExistingPlace(place: NewPlace) {
    if (place.placeId) {
      const { data, error } = await this.supabase
        .from('saved_places')
        .select('*')
        .eq('place_id', place.placeId)
        .eq('user_id', this.userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        throw toSupabaseError('duplicate check', error.message);
      }

      if (data) {
        return mapRowToPlace(data);
      }
    }

    const normalizedSourceUrl = normalizeInstagramSourceUrl(place.sourceInstagramUrl);
    const { data, error } = await this.supabase
      .from('saved_places')
      .select('*')
      .eq('source_url', normalizedSourceUrl)
      .eq('user_id', this.userId)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw toSupabaseError('duplicate check', error.message);
    }

    return data ? mapRowToPlace(data) : undefined;
  }

  async listPlaces() {
    const { data, error } = await this.supabase
      .from('saved_places')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw toSupabaseError('read', error.message);
    }

    return (data ?? []).map(mapRowToPlace);
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

  async createPlace(place: NewPlace) {
    const existingPlace = await this.findExistingPlace(place);

    if (existingPlace) {
      if (shouldReplaceIncompleteManualPlace(existingPlace, place)) {
        return this.updatePlace(existingPlace.id, {
          placeName: place.placeName,
          address: place.address,
          areaCity: place.areaCity,
          category: place.category,
          cuisineOrSpecialty: place.cuisineOrSpecialty,
          tags: place.tags,
          sourceInstagramUrl: place.sourceInstagramUrl,
          placeId: place.placeId,
          mapUrl: place.mapUrl
        });
      }

      return existingPlace;
    }

    const { data, error } = await this.supabase
      .from('saved_places')
      .insert(mapPlaceToRow(place, this.userId))
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const duplicatePlace = await this.findExistingPlace(place);

        if (duplicatePlace) {
          return duplicatePlace;
        }
      }

      throw toSupabaseError('create', error.message);
    }

    if (!data) {
      throw toSupabaseError('create');
    }

    return mapRowToPlace(data);
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

    return mapRowToPlace(data);
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
