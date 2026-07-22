import { FunctionsHttpError } from '@supabase/supabase-js';

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

const getImportErrorMessage = async (error: unknown) => {
  if (error instanceof FunctionsHttpError) {
    const response = (await error.context
      .json()
      .catch(() => undefined)) as InstagramImportFunctionResponse | undefined;

    return response?.error?.message || error.message;
  }

  return error instanceof Error ? error.message : 'Instagram import failed.';
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
      throw new Error(await getImportErrorMessage(error));
    }

    if (data?.error) {
      throw new Error(data.error.message || 'Instagram import failed.');
    }

    if (!data?.data) {
      throw new Error('Instagram import returned no useful metadata.');
    }

    return data.data;
  }
};
