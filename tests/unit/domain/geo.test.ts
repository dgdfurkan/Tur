import { describe, expect, it } from 'vitest';
import { GeoPoint } from '@/domain/geo/GeoPoint';
import { MapProjection } from '@/domain/geo/MapProjection';

describe('GeoPoint', () => {
  it('measures the great-circle distance between Ankara and İstanbul', () => {
    const ankara = new GeoPoint(39.9208, 32.8541);
    const istanbul = new GeoPoint(41.0082, 28.9784);
    expect(ankara.distanceKmTo(istanbul)).toBeGreaterThan(345);
    expect(ankara.distanceKmTo(istanbul)).toBeLessThan(355);
  });

  it('rejects coordinates outside the globe', () => {
    expect(() => new GeoPoint(91, 0)).toThrow(RangeError);
    expect(() => new GeoPoint(0, 181)).toThrow(RangeError);
  });
});

describe('MapProjection', () => {
  const projection = new MapProjection(39, 35);

  it('places the origin at zero', () => {
    const point = projection.project({ lat: 39, lon: 35 });
    expect(point.x).toBeCloseTo(0);
    expect(point.y).toBeCloseTo(0);
  });

  it('maps east to +x and north to +y in kilometres', () => {
    const north = projection.project({ lat: 40, lon: 35 });
    const east = projection.project({ lat: 39, lon: 36 });
    expect(north.y).toBeCloseTo(111.32, 1);
    expect(north.x).toBeCloseTo(0);
    expect(east.x).toBeCloseTo(111.32 * Math.cos((39 * Math.PI) / 180), 1);
  });
});
