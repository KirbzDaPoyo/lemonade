import { apifyInstagramImportProvider } from './apifyInstagramImportProvider';
import { mockInstagramImportProvider } from './mockInstagramImportProvider';

const providerName = process.env.EXPO_PUBLIC_INSTAGRAM_IMPORT_PROVIDER ?? 'apify';

export const instagramImportProvider =
  providerName === 'mock' ? mockInstagramImportProvider : apifyInstagramImportProvider;

export type { InstagramImportInput, InstagramImportProvider } from './types';
