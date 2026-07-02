import { DraftPlaceEntry, PlaceCandidate } from '../types/place';

export type AppRoute =
  | { name: 'Home' }
  | { name: 'AddPlace' }
  | {
      name: 'CandidateMatch';
      draft: DraftPlaceEntry;
      candidates: PlaceCandidate[];
    }
  | { name: 'PlaceDetail'; placeId: string };

export type AppNavigation = {
  navigate: (route: AppRoute) => void;
  goBack: () => void;
  resetToHome: () => void;
};
