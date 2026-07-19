import { createSupabaseClient } from '../../lib/supabaseClient';
import { InstagramImportResult } from '../../types/instagramImport';
import { InstagramImportInput, InstagramImportProvider } from './types';

type InstagramImportFunctionResponse = {
  data?: InstagramImportResult;
  error?: {
    code?: string;
    message?: string;
  };
};

const logSanitizedImport = (result: InstagramImportResult) => {
  console.log('[instagram-import]', {
    caption: result.caption?.trim() ? 'present' : 'empty',
    hashtags: result.hashtags,
    mentions: result.mentions,
    taggedUsers: result.taggedUsers,
    collaborators: result.collaborators,
    location: {
      name: result.locationName,
      address: result.locationAddress,
      city: result.locationCity,
      country: result.locationCountry,
      lat: result.locationLat,
      lng: result.locationLng
    }
  });
};

export const apifyInstagramImportProvider: InstagramImportProvider = {
  async importUrl({ url }: InstagramImportInput) {
    const supabase = createSupabaseClient();

    if (!supabase) {
      throw new Error('Instagram import needs Supabase configuration.');
    }

    const { data, error } = await supabase.functions.invoke<InstagramImportFunctionResponse>(
      'instagram-import',
      {
        body: { url }
      }
    );

    if (error) {
      throw new Error(error.message || 'Instagram import failed.');
    }

    if (data?.error) {
      throw new Error(data.error.message || 'Instagram import failed.');
    }

    if (!data?.data) {
      throw new Error('Instagram import returned no useful metadata.');
    }

    logSanitizedImport(data.data);

    return data.data;
  }
};
