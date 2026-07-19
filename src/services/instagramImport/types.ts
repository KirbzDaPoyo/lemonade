import { InstagramImportResult } from '../../types/instagramImport';

export type InstagramImportInput = {
  url: string;
};

export interface InstagramImportProvider {
  importUrl(input: InstagramImportInput): Promise<InstagramImportResult>;
}
