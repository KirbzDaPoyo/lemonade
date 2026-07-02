import { PlaceCategory, PlaceStatus } from './place';

export type PlaceFilters = {
  status?: PlaceStatus | 'all';
  category?: PlaceCategory | 'all';
  tag?: string;
};
