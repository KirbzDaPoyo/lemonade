import { PlaceCategory, PlaceCard } from '../types/place';
import { getTagLabel } from './tags/placeTagNormalizer';
import { categoryLabels } from '../utils/labels';

export type PlaceFilterKey =
  | 'all'
  | 'coffee'
  | 'restaurant'
  | 'dessert'
  | 'bar'
  | 'market'
  | 'street_food'
  | 'bakery'
  | 'tea'
  | 'ramen'
  | 'noodles'
  | 'cantonese'
  | 'pizza'
  | 'other';

export type PlaceFilterOption = {
  key: PlaceFilterKey;
  label: string;
  matchesPlace: (place: PlaceCard) => boolean;
};

const hasTag = (place: PlaceCard, tag: string) => place.tags.includes(tag);
const hasAnyTag = (place: PlaceCard, tags: string[]) => tags.some((tag) => hasTag(place, tag));
const hasCategory = (place: PlaceCard, category: PlaceCategory) => place.category === category;

const baseFilterDefinitions: PlaceFilterOption[] = [
  {
    key: 'all',
    label: 'All places',
    matchesPlace: () => true
  },
  {
    key: 'coffee',
    label: 'Coffee',
    matchesPlace: (place) => hasCategory(place, 'cafe') || hasTag(place, 'coffee')
  },
  {
    key: 'restaurant',
    label: categoryLabels.restaurant,
    matchesPlace: (place) => hasCategory(place, 'restaurant')
  },
  {
    key: 'dessert',
    label: categoryLabels.dessert,
    matchesPlace: (place) => hasCategory(place, 'dessert') || hasTag(place, 'dessert')
  },
  {
    key: 'bar',
    label: categoryLabels.bar,
    matchesPlace: (place) => hasCategory(place, 'bar') || hasAnyTag(place, ['bar', 'cocktails', 'wine'])
  },
  {
    key: 'market',
    label: categoryLabels.market,
    matchesPlace: (place) => hasCategory(place, 'market') || hasTag(place, 'market')
  },
  {
    key: 'street_food',
    label: categoryLabels.street_food,
    matchesPlace: (place) => hasCategory(place, 'street_food') || hasTag(place, 'street_food')
  },
  {
    key: 'bakery',
    label: getTagLabel('bakery'),
    matchesPlace: (place) => hasAnyTag(place, ['bakery', 'bagels'])
  },
  {
    key: 'tea',
    label: getTagLabel('tea'),
    matchesPlace: (place) => hasTag(place, 'tea')
  },
  {
    key: 'ramen',
    label: getTagLabel('ramen'),
    matchesPlace: (place) => hasTag(place, 'ramen')
  },
  {
    key: 'noodles',
    label: getTagLabel('noodles'),
    matchesPlace: (place) => hasTag(place, 'noodles')
  },
  {
    key: 'cantonese',
    label: getTagLabel('cantonese'),
    matchesPlace: (place) => hasTag(place, 'cantonese')
  },
  {
    key: 'pizza',
    label: getTagLabel('pizza'),
    matchesPlace: (place) => hasTag(place, 'pizza')
  },
  {
    key: 'other',
    label: categoryLabels.other,
    matchesPlace: (place) => hasCategory(place, 'other') && place.tags.length === 0
  }
];

export const getPlaceFilterOptions = (places: PlaceCard[]) =>
  baseFilterDefinitions.filter(
    (option) => option.key === 'all' || places.some((place) => option.matchesPlace(place))
  );

export const findPlaceFilterOption = (options: PlaceFilterOption[], key: PlaceFilterKey) =>
  options.find((option) => option.key === key) ?? options[0];