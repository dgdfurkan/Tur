const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** A position on Earth in decimal degrees. */
export class GeoPoint {
  constructor(
    readonly lat: number,
    readonly lon: number,
  ) {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new RangeError(`Latitude out of range: ${lat}`);
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw new RangeError(`Longitude out of range: ${lon}`);
    }
  }

  /** Great-circle distance (haversine). */
  distanceKmTo(other: GeoPoint): number {
    const dLat = toRadians(other.lat - this.lat);
    const dLon = toRadians(other.lon - this.lon);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(this.lat)) * Math.cos(toRadians(other.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
  }
}
