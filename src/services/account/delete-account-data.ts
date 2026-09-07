import { createFreshTokenSupabaseClient } from '../../lib/supabaseClient';

export type AccountDataDeletionCounts = {
  savedPlacesDeleted: number;
  placeTagsDeleted: number;
};

type DeletionRow = {
  saved_places_deleted?: number;
  place_tags_deleted?: number;
};

const toCount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

export const deleteCurrentUserData = async (
  freshAccessToken: string
): Promise<AccountDataDeletionCounts> => {
  const supabase = createFreshTokenSupabaseClient(freshAccessToken);

  if (!supabase) {
    throw new Error('Cloud storage is not configured.');
  }

  const { data, error } = await supabase.rpc('delete_current_user_data');

  if (error) {
    throw new Error(`Supabase account data deletion failed: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : data) as DeletionRow | null;

  if (!row) {
    throw new Error('Supabase account data deletion returned no confirmation.');
  }

  return {
    savedPlacesDeleted: toCount(row.saved_places_deleted),
    placeTagsDeleted: toCount(row.place_tags_deleted)
  };
};
