import { PlaceCandidate } from '../types/place';

export const mockPlaceCandidates: PlaceCandidate[] = [
  {
    provider: 'mock',
    providerPlaceId: 'mock-lemon-house-cafe',
    name: 'Lemon House Cafe',
    address: '12 Garden Lane, Old Town',
    areaCity: 'Bangkok',
    category: 'cafe',
    cuisineOrSpecialty: 'espresso, lemon tart',
    tags: ['coffee', 'brunch', 'quiet'],
    mapUrl: 'https://maps.google.com/?q=Lemon+House+Cafe+Bangkok'
  },
  {
    provider: 'mock',
    providerPlaceId: 'mock-saffron-table',
    name: 'Saffron Table',
    address: '88 Market Road, Riverside',
    areaCity: 'Bangkok',
    category: 'restaurant',
    cuisineOrSpecialty: 'modern Thai',
    tags: ['dinner', 'date-night', 'thai'],
    mapUrl: 'https://maps.google.com/?q=Saffron+Table+Bangkok'
  },
  {
    provider: 'mock',
    providerPlaceId: 'mock-midnight-noodles',
    name: 'Midnight Noodles',
    address: '5 Soi Lantern, Chinatown',
    areaCity: 'Bangkok',
    category: 'street_food',
    cuisineOrSpecialty: 'boat noodles',
    tags: ['late-night', 'noodles', 'casual'],
    mapUrl: 'https://maps.google.com/?q=Midnight+Noodles+Bangkok'
  },
  {
    provider: 'mock',
    providerPlaceId: 'mock-honeycomb-dessert-room',
    name: 'Honeycomb Dessert Room',
    address: '21 Sweet Street, Ari',
    areaCity: 'Bangkok',
    category: 'dessert',
    cuisineOrSpecialty: 'shaved ice, honey toast',
    tags: ['dessert', 'family', 'instagrammable'],
    mapUrl: 'https://maps.google.com/?q=Honeycomb+Dessert+Room+Bangkok'
  },
  {
    provider: 'mock',
    providerPlaceId: 'mock-canal-night-market',
    name: 'Canal Night Market',
    address: '44 Canal Walk, Khlong San',
    areaCity: 'Bangkok',
    category: 'market',
    cuisineOrSpecialty: 'snacks and local vendors',
    tags: ['market', 'street-food', 'shopping'],
    mapUrl: 'https://maps.google.com/?q=Canal+Night+Market+Bangkok'
  }
];
