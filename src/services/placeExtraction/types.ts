import { PlaceExtractionResult } from '../../types/extraction';
import { InstagramImportResult } from '../../types/instagramImport';

export type PlaceExtractionInput = {
  sourceUrl: string;
  sharedText?: string;
  captionText?: string;
  userHint?: string;
  instagramImport?: InstagramImportResult;
};

export interface PlaceExtractionProvider {
  extractPlace(input: PlaceExtractionInput): Promise<PlaceExtractionResult>;
}

export type PlaceExtractionService = PlaceExtractionProvider;
