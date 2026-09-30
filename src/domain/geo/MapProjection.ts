const KM_PER_DEGREE = 111.32;

export interface GeoCoordinates {
  readonly lat: number;
  readonly lon: number;
}

export interface PlanePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Equirectangular projection around a reference point, in kilometres.
 * Across Turkey's extent the distortion is a few percent, which an illustrated
 * map absorbs; in return the build script and the browser share one tiny class
 * instead of a geo library.
 */
export class MapProjection {
  // Explicit fields rather than parameter properties: the map build script runs
  // this file through Node's type stripping, which only removes erasable syntax.
  private readonly originLat: number;
  private readonly originLon: number;
  private readonly lonScale: number;

  constructor(originLat: number, originLon: number) {
    this.originLat = originLat;
    this.originLon = originLon;
    this.lonScale = Math.cos((originLat * Math.PI) / 180);
  }

  /** East is +x, north is +y. */
  project(point: GeoCoordinates): PlanePoint {
    return {
      x: (point.lon - this.originLon) * this.lonScale * KM_PER_DEGREE,
      y: (point.lat - this.originLat) * KM_PER_DEGREE,
    };
  }
}

/** Shared by the map build script and the runtime so both place points identically. */
export const TURKEY_PROJECTION = new MapProjection(39, 35.2);
