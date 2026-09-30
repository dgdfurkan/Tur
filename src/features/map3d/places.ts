import type { GeoCoordinates } from '@/domain/geo/MapProjection';

/** Reference geography drawn on every map, independent of any tour. */
export interface City extends GeoCoordinates {
  readonly name: string;
  /** Tier 1 cities are labelled at every zoom level. */
  readonly tier: 1 | 2;
}

export interface Peak extends GeoCoordinates {
  readonly name: string;
  readonly heightM: number;
}

export interface Sea extends GeoCoordinates {
  readonly name: string;
}

export const CITIES: readonly City[] = [
  { name: 'Ankara', lat: 39.92, lon: 32.85, tier: 1 },
  { name: 'İstanbul', lat: 41.01, lon: 28.98, tier: 1 },
  { name: 'İzmir', lat: 38.42, lon: 27.14, tier: 1 },
  { name: 'Antalya', lat: 36.89, lon: 30.71, tier: 1 },
  { name: 'Trabzon', lat: 41.0, lon: 39.72, tier: 1 },
  { name: 'Adana', lat: 37.0, lon: 35.32, tier: 1 },
  { name: 'Erzurum', lat: 39.9, lon: 41.27, tier: 1 },
  { name: 'Diyarbakır', lat: 37.91, lon: 40.24, tier: 1 },
  { name: 'Konya', lat: 37.87, lon: 32.49, tier: 2 },
  { name: 'Kayseri', lat: 38.72, lon: 35.49, tier: 2 },
  { name: 'Samsun', lat: 41.29, lon: 36.33, tier: 2 },
  { name: 'Eskişehir', lat: 39.78, lon: 30.52, tier: 2 },
  { name: 'Bursa', lat: 40.19, lon: 29.06, tier: 2 },
  { name: 'Sivas', lat: 39.75, lon: 37.02, tier: 2 },
  { name: 'Gaziantep', lat: 37.07, lon: 37.38, tier: 2 },
  { name: 'Van', lat: 38.49, lon: 43.38, tier: 2 },
  { name: 'Denizli', lat: 37.78, lon: 29.09, tier: 2 },
  { name: 'Çanakkale', lat: 40.15, lon: 26.41, tier: 2 },
  { name: 'Kastamonu', lat: 41.38, lon: 33.78, tier: 2 },
  { name: 'Muğla', lat: 37.22, lon: 28.36, tier: 2 },
];

export const PEAKS: readonly Peak[] = [
  { name: 'Ağrı Dağı', lat: 39.7, lon: 44.3, heightM: 5137 },
  { name: 'Süphan Dağı', lat: 38.93, lon: 42.83, heightM: 4058 },
  { name: 'Kaçkar Dağı', lat: 40.83, lon: 41.16, heightM: 3937 },
  { name: 'Erciyes Dağı', lat: 38.53, lon: 35.45, heightM: 3917 },
  { name: 'Hasan Dağı', lat: 38.13, lon: 34.17, heightM: 3268 },
  { name: 'Uludağ', lat: 40.07, lon: 29.22, heightM: 2543 },
  { name: 'Ilgaz Dağı', lat: 41.06, lon: 33.73, heightM: 2587 },
  { name: 'Bey Dağları', lat: 36.58, lon: 30.1, heightM: 3086 },
  { name: 'Aladağlar', lat: 37.8, lon: 35.15, heightM: 3756 },
];

export const SEAS: readonly Sea[] = [
  { name: 'Karadeniz', lat: 42.7, lon: 35.2 },
  { name: 'Akdeniz', lat: 35.4, lon: 31.6 },
  { name: 'Ege Denizi', lat: 38.7, lon: 25.5 },
  { name: 'Marmara Denizi', lat: 40.68, lon: 28.2 },
];
