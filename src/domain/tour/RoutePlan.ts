import { TURKEY_PROJECTION, type MapProjection, type PlanePoint } from '../geo/MapProjection';
import type { Stop, Tour } from './Tour';

export interface RouteStop {
  readonly index: number;
  readonly stop: Stop;
  /** Day of the tour on which the stop is visited, starting at 1. */
  readonly day: number;
  /** Position on the map plane, in kilometres. */
  readonly point: PlanePoint;
  /** Straight-line distance travelled from the first stop. */
  readonly distanceKm: number;
}

export interface RouteBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** The geometry of a tour: its stops in travel order, laid out on the map plane. */
export class RoutePlan {
  private constructor(readonly stops: readonly RouteStop[]) {}

  static fromTour(tour: Tour, projection: MapProjection = TURKEY_PROJECTION): RoutePlan {
    const stops: RouteStop[] = [];
    let travelled = 0;
    for (const day of tour.days) {
      for (const stop of day.stops) {
        const previous = stops.at(-1);
        if (previous) travelled += previous.stop.location.distanceKmTo(stop.location);
        stops.push({
          index: stops.length,
          stop,
          day: day.number,
          point: projection.project(stop.location),
          distanceKm: travelled,
        });
      }
    }
    return new RoutePlan(stops);
  }

  get legCount(): number {
    return Math.max(0, this.stops.length - 1);
  }

  get totalKm(): number {
    return this.stops.at(-1)?.distanceKm ?? 0;
  }

  /** Straight-line length of the leg that starts at the given stop. */
  legKm(fromIndex: number): number {
    const from = this.stops[fromIndex];
    const to = this.stops[fromIndex + 1];
    return from && to ? to.distanceKm - from.distanceKm : 0;
  }

  get bounds(): RouteBounds {
    const xs = this.stops.map((stop) => stop.point.x);
    const ys = this.stops.map((stop) => stop.point.y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }
}
