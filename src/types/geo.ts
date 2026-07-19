export type GeoRegionCode = 'HK' | 'SG' | string;

export type LocationBiasRectangle = {
  low: {
    latitude: number;
    longitude: number;
  };
  high: {
    latitude: number;
    longitude: number;
  };
};

export type GeoContext = {
  regionCode: GeoRegionCode;
  searchSuffix: string;
  locationBias: LocationBiasRectangle;
};
