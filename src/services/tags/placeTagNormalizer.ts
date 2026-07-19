import { PlaceCategory } from '../../types/place';

export type TagNormalizationInput = {
  placeName?: string | null;
  category?: PlaceCategory | null;
  cuisineOrSpecialty?: string | null;
  signals: string[];
};

const allowedTags = new Set([
  'breakfast',
  'brunch',
  'lunch',
  'dinner',
  'late_night',
  'open_24_7',
  'coffee',
  'tea',
  'bakery',
  'dessert',
  'ramen',
  'noodles',
  'dim_sum',
  'sushi',
  'pizza',
  'thai',
  'cantonese',
  'bagels',
  'seafood',
  'cocktails',
  'wine',
  'bar',
  'date_spot',
  'solo_friendly',
  'work_friendly',
  'good_for_groups',
  'family_friendly',
  'self_service',
  'takeout',
  'reservation_needed',
  'queue_expected',
  'hidden_gem',
  'mall',
  'waterfront',
  'street_food',
  'market',
  'pet_friendly',
  'quiet',
  'casual'
]);

const categoryTags: Partial<Record<PlaceCategory, string[]>> = {
  cafe: ['coffee'],
  dessert: ['dessert'],
  bar: ['bar'],
  market: ['market'],
  street_food: ['street_food']
};

const noisySignals = [
  'fyp',
  'viral',
  'trending',
  'explorepage',
  'reels',
  'reel',
  'instagram',
  'insta',
  'foodie',
  'foodies',
  'hkfoodie',
  'hkfoodies',
  'hkfood',
  'hkfoods',
  'hkeats',
  'hkliving',
  'hkblog',
  'hkblogger',
  'blog',
  'blogger',
  'lifestyle',
  'vlog',
  'travel',
  'travels',
  'traveller',
  'traveler',
  'discoverhongkong',
  'hongkongtravel',
  'hongkongtravels'
];

const normalizeSignal = (value: string) =>
  value
    .trim()
    .replace(/^#+/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9/\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isNoisySignal = (value: string) => {
  const compact = value.replace(/\s+/g, '');

  return noisySignals.some((noise) => compact === noise || compact.includes(noise));
};

const addTag = (tags: Set<string>, tag: string | undefined) => {
  if (tag && allowedTags.has(tag)) {
    tags.add(tag);
  }
};

const mapSignalToTags = (value: string) => {
  const tags: string[] = [];

  if (/\b(24\/7|24 7|24hr|24 hour|all night|late night|3 am|midnight)\b/.test(value)) {
    tags.push(value.includes('24') ? 'open_24_7' : 'late_night');
  }
  if (/\b(self serve|self service|no staff|unmanned|automated)\b/.test(value)) tags.push('self_service');
  if (/\b(brunch)\b/.test(value)) tags.push('brunch');
  if (/\b(breakfast)\b/.test(value)) tags.push('breakfast');
  if (/\b(lunch)\b/.test(value)) tags.push('lunch');
  if (/\b(dinner)\b/.test(value)) tags.push('dinner');
  if (/\b(coffee|espresso|latte|cappuccino|cafe)\b/.test(value)) tags.push('coffee');
  if (/\b(tea|matcha)\b/.test(value)) tags.push('tea');
  if (/\b(bakery|bakehouse|pastry|croissant|bagel|bagels)\b/.test(value)) tags.push(value.includes('bagel') ? 'bagels' : 'bakery');
  if (/\b(dessert|cake|ice cream|gelato|toast)\b/.test(value)) tags.push('dessert');
  if (/\b(ramen)\b/.test(value)) tags.push('ramen');
  if (/\b(noodle|noodles|soba|udon)\b/.test(value)) tags.push('noodles');
  if (/\b(dim sum|dimsum)\b/.test(value)) tags.push('dim_sum');
  if (/\b(sushi|omakase)\b/.test(value)) tags.push('sushi');
  if (/\b(pizza)\b/.test(value)) tags.push('pizza');
  if (/\b(thai)\b/.test(value)) tags.push('thai');
  if (/\b(cantonese|cha chaan teng)\b/.test(value)) tags.push('cantonese');
  if (/\b(seafood|crab|oyster)\b/.test(value)) tags.push('seafood');
  if (/\b(cocktail|cocktails)\b/.test(value)) tags.push('cocktails');
  if (/\b(wine)\b/.test(value)) tags.push('wine');
  if (/\b(bar)\b/.test(value)) tags.push('bar');
  if (/\b(date|romantic)\b/.test(value)) tags.push('date_spot');
  if (/\b(solo|alone)\b/.test(value)) tags.push('solo_friendly');
  if (/\b(work|laptop|wifi|quiet)\b/.test(value)) tags.push(value.includes('quiet') ? 'quiet' : 'work_friendly');
  if (/\b(group|groups|friends)\b/.test(value)) tags.push('good_for_groups');
  if (/\b(family|kids)\b/.test(value)) tags.push('family_friendly');
  if (/\b(takeout|takeaway|to go)\b/.test(value)) tags.push('takeout');
  if (/\b(reservation|book ahead|booking)\b/.test(value)) tags.push('reservation_needed');
  if (/\b(queue|line up|wait)\b/.test(value)) tags.push('queue_expected');
  if (/\b(hidden gem|underrated|hole in the wall)\b/.test(value)) tags.push('hidden_gem');
  if (/\b(mall|harbour city|world trade centre|mikiki|terminal)\b/.test(value)) tags.push('mall');
  if (/\b(waterfront|harbour|harbor|pier)\b/.test(value)) tags.push('waterfront');
  if (/\b(street food|stall|hawker)\b/.test(value)) tags.push('street_food');
  if (/\b(market)\b/.test(value)) tags.push('market');
  if (/\b(pet friendly|dog friendly)\b/.test(value)) tags.push('pet_friendly');
  if (/\b(casual|vibes|chill)\b/.test(value)) tags.push('casual');

  return tags;
};

export const normalizePlaceTags = ({
  placeName,
  category,
  cuisineOrSpecialty,
  signals
}: TagNormalizationInput) => {
  const tags = new Set<string>();

  categoryTags[category ?? 'other']?.forEach((tag) => addTag(tags, tag));

  [placeName ?? '', ...signals, cuisineOrSpecialty ?? '']
    .map(normalizeSignal)
    .filter(Boolean)
    .filter((signal) => !isNoisySignal(signal))
    .flatMap(mapSignalToTags)
    .forEach((tag) => addTag(tags, tag));

  return Array.from(tags).slice(0, 8);
};

export const getTagLabel = (tag: string) =>
  tag
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace('24 7', '24/7');