import type { PlaceExtractionResult } from '../../types/extraction';
import type { InstagramImportResult } from '../../types/instagramImport';

export type PlaceExtractionInput = {
  userHint?: string;
  instagramImport?: InstagramImportResult;
};

export interface PlaceExtractionService {
  extractPlace(input: PlaceExtractionInput): Promise<PlaceExtractionResult>;
}
