import { PlaceExtractionResult } from '../../types/extraction';

export type PlaceExtractionInput = {
  source_url: string;
  caption_text: string;
  user_notes?: string;
};

export interface PlaceExtractionService {
  extractPlace(input: PlaceExtractionInput): Promise<PlaceExtractionResult>;
}
