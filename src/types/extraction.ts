import type { PlaceCategory } from './place';

export type PlaceExtractionResult = {
  place_name: string;
  area_or_city: string;
  category: PlaceCategory;
  cuisine_or_specialty: string;
  recommended_items: string[];
  vibe_tags: string[];
  visible_clues: string[];
  confidence: number;
  needs_user_confirmation: boolean;
};
