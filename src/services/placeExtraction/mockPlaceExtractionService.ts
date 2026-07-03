import type { PlaceExtractionResult } from '../../types/extraction';
import type { PlaceCategory } from '../../types/place';
import type { PlaceExtractionInput, PlaceExtractionService } from './types';

type MockExtractionProfile = {
  keywords: string[];
  result: Omit<PlaceExtractionResult, 'visible_clues' | 'confidence' | 'needs_user_confirmation'>;
};

const profiles: MockExtractionProfile[] = [
  {
    keywords: ['noodle', 'noodles', 'boat noodle', 'late night'],
    result: {
      place_name: 'Midnight Noodles',
      area_or_city: 'Bangkok',
      category: 'street_food',
      cuisine_or_specialty: 'boat noodles',
      recommended_items: ['boat noodles', 'crispy pork'],
      vibe_tags: ['late-night', 'casual', 'street-food']
    }
  },
  {
    keywords: ['dessert', 'toast', 'shaved ice', 'honey'],
    result: {
      place_name: 'Honeycomb Dessert Room',
      area_or_city: 'Bangkok',
      category: 'dessert',
      cuisine_or_specialty: 'shaved ice and honey toast',
      recommended_items: ['honey toast', 'mango shaved ice'],
      vibe_tags: ['dessert', 'family', 'bright']
    }
  },
  {
    keywords: ['market', 'vendor', 'vendors', 'snack'],
    result: {
      place_name: 'Canal Night Market',
      area_or_city: 'Bangkok',
      category: 'market',
      cuisine_or_specialty: 'local snacks and vendors',
      recommended_items: ['grilled skewers', 'coconut pancakes'],
      vibe_tags: ['market', 'street-food', 'walkable']
    }
  },
  {
    keywords: ['thai', 'dinner', 'saffron', 'date'],
    result: {
      place_name: 'Saffron Table',
      area_or_city: 'Bangkok',
      category: 'restaurant',
      cuisine_or_specialty: 'modern Thai',
      recommended_items: ['green curry', 'river prawns'],
      vibe_tags: ['dinner', 'date-night', 'thai']
    }
  },
  {
    keywords: ['coffee', 'cafe', 'brunch', 'espresso', 'lemon'],
    result: {
      place_name: 'Lemon House Cafe',
      area_or_city: 'Bangkok',
      category: 'cafe',
      cuisine_or_specialty: 'espresso and lemon tart',
      recommended_items: ['espresso', 'lemon tart'],
      vibe_tags: ['coffee', 'brunch', 'quiet']
    }
  }
];

const defaultResult: MockExtractionProfile['result'] = {
  place_name: 'Lemon House Cafe',
  area_or_city: 'Bangkok',
  category: 'cafe',
  cuisine_or_specialty: 'coffee and pastries',
  recommended_items: ['signature drink'],
  vibe_tags: ['saved-from-instagram', 'needs-review']
};

const normalize = (value: string) => value.trim().toLowerCase();

const inferProfile = (text: string) =>
  profiles.find((profile) =>
    profile.keywords.some((keyword) => text.includes(normalize(keyword)))
  );

const inferCategoryClue = (category: PlaceCategory) => {
  if (category === 'street_food') {
    return 'Caption hints at a street food vendor.';
  }

  return `Caption hints at the ${category} category.`;
};

export const mockPlaceExtractionService: PlaceExtractionService = {
  async extractPlace({
    source_url,
    caption_text,
    user_notes
  }: PlaceExtractionInput): Promise<PlaceExtractionResult> {
    const combinedText = normalize(`${caption_text} ${user_notes ?? ''} ${source_url}`);
    const matchedProfile = inferProfile(combinedText);
    const result = matchedProfile?.result ?? defaultResult;
    const confidence = matchedProfile ? 0.74 : 0.48;

    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });

    return {
      ...result,
      visible_clues: [
        source_url.includes('instagram.com')
          ? 'Instagram post or reel URL provided.'
          : 'Source URL needs review.',
        caption_text.trim()
          ? 'Caption text was available for extraction.'
          : 'No caption text was provided.',
        inferCategoryClue(result.category)
      ],
      confidence,
      needs_user_confirmation: confidence < 0.8
    };
  }
};
