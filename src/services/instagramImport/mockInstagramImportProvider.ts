import { InstagramImportResult } from '../../types/instagramImport';
import { InstagramImportInput, InstagramImportProvider } from './types';

export const mockInstagramImportProvider: InstagramImportProvider = {
  async importUrl({ url }: InstagramImportInput): Promise<InstagramImportResult> {
    return {
      sourceUrl: url,
      inputUrl: url,
      caption: undefined,
      hashtags: [],
      mentions: [],
      taggedUsers: [],
      collaborators: [],
      instagramUrl: url,
      productType: 'mock',
      rawType: 'mock'
    };
  }
};
