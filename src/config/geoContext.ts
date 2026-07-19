import { GeoContext } from '../types/geo';

export const geoPresets: Record<'HK' | 'SG', GeoContext> = {
  HK: {
    regionCode: 'HK',
    searchSuffix: 'Hong Kong',
    locationBias: {
      low: { latitude: 22.13, longitude: 113.82 },
      high: { latitude: 22.57, longitude: 114.43 }
    }
  },
  SG: {
    regionCode: 'SG',
    searchSuffix: 'Singapore',
    locationBias: {
      low: { latitude: 1.16, longitude: 103.6 },
      high: { latitude: 1.48, longitude: 104.1 }
    }
  }
};

const requestedDefaultRegion = process.env.EXPO_PUBLIC_DEFAULT_SEARCH_REGION?.toUpperCase();

export const getDefaultGeoContext = () =>
  requestedDefaultRegion === 'SG' ? geoPresets.SG : geoPresets.HK;

export const inferGeoContext = (text: string): GeoContext => {
  const normalized = text.toLowerCase();

  if (/(hong\s*kong|hongkong|\bhk\b|\u9999\u6e2f)/i.test(normalized)) {
    return geoPresets.HK;
  }

  if (/(singapore|\bsg\b|\u65b0\u52a0\u5761)/i.test(normalized)) {
    return geoPresets.SG;
  }

  return getDefaultGeoContext();
};
