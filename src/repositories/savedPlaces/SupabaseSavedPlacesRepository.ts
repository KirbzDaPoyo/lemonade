import type { SupabaseClient } from '@supabase/supabase-js';

import { SavedPlaceRow } from '../../lib/supabaseClient';
import { PlaceCard } from '../../types/place';
import { normalizeInstagramSourceUrl } from './placeIdentity';
import { NewPlace, PlaceUpdate, SavedPlacesRepository } from './types';

const mapRowToPlace = (row: SavedPlaceRow): PlaceCard => ({
  id: row.id,
  placeName: row.name,
  address: row.address,
  areaCity: row.area_or_city,
  category: row.category,
  cuisineOrSpecialty: row.cuisine_or_specialty ?? undefined,
  tags: row.tags,
  notes: row.notes ?? undefined,
  sourceInstagramUrl: row.source_url,
  placeId: row.place_id ?? undefined,
  mapUrl: row.map_url ?? undefined,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

type SavedPlaceInsert = Omit<SavedPlaceRow, 'created_at' | 'updated_at'>;

const mapPlaceToRow = (place: NewPlace): SavedPlaceInsert => ({
  id: place.id,
  name: place.placeName,
  address: place.address,
  area_or_city: place.areaCity,
  category: place.category,
  cuisine_or_specialty: place.cuisineOrSpecialty ?? null,
  tags: place.tags,
  notes: place.notes ?? null,
  source_url: normalizeInstagramSourceUrl(place.sourceInstagramUrl),
  place_id: place.placeId ?? null,
  map_url: place.mapUrl ?? null,
  status: place.status
});

const mapPlaceUpdateToRow = (updates: PlaceUpdate): Partial<SavedPlaceRow> => ({
  ...(updates.placeName !== undefined ? { name: updates.placeName } : {}),
  ...(updates.address !== undefined ? { address: updates.address } : {}),
  ...(updates.areaCity !== undefined ? { area_or_city: updates.areaCity } : {}),
  ...(updates.category !== undefined ? { category: updates.category } : {}),
  ...(updates.cuisineOrSpecialty !== undefined
    ? { cuisine_or_specialty: updates.cuisineOrSpecialty ?? null }
    : {}),
  ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
  ...(updates.notes !== undefined ? { notes: updates.notes ?? null } : {}),
  ...(updates.sourceInstagramUrl !== undefined
    ? { source_url: normalizeInstagramSourceUrl(updates.sourceInstagramUrl) }
    : {}),
  ...(updates.placeId !== undefined ? { place_id: updates.placeId ?? null } : {}),
  ...(updates.mapUrl !== undefined ? { map_url: updates.mapUrl ?? null } : {}),
  ...(updates.status !== undefined ? { status: updates.status } : {})
});

const toSupabaseError = (action: string, message?: string) =>
  new Error(`Supabase saved places ${action} failed${message ? `: ${message}` : '.'}`);

export class SupabaseSavedPlacesRepository implements SavedPlacesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  private async findExistingPlace(place: NewPlace) {
    if (place.placeId) {
      const { data, error } = await this.supabase
        .from('saved_places')
        .select('*')
        .eq('place_id', place.placeId)
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
      .order('created_at', { ascending: false });

    if (error) {
      throw toSupabaseError('read', error.message);
    }

    return (data ?? []).map(mapRowToPlace);
  }

  async createPlace(place: NewPlace) {
    const normalizedPlace = {
      ...place,
      sourceInstagramUrl: normalizeInstagramSourceUrl(place.sourceInstagramUrl)
    };
    const existingPlace = await this.findExistingPlace(normalizedPlace);

    if (existingPlace) {
      return existingPlace;
    }

    const { data, error } = await this.supabase
      .from('saved_places')
      .insert(mapPlaceToRow(normalizedPlace))
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const duplicatePlace = await this.findExistingPlace(normalizedPlace);

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
    const { error } = await this.supabase.from('saved_places').delete().eq('id', id);

    if (error) {
      throw toSupabaseError('delete', error.message);
    }
  }
}
