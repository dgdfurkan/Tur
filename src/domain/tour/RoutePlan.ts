import { TURKEY_PROJECTION, type MapProjection, type PlanePoint } from '../geo/MapProjection';
import type { Stop, Tour } from './Tour';

/** The least a route needs to know about a place in order to be drawn on a map. */
export type RoutePlace = Pick<Stop, 'name' | 'kind' | 'location'>;

export interface RouteStop<P extends RoutePlace = Stop> {
  readonly index: number;
  readonly stop: P;
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

/** Stops closer together than this are treated as one place. */
const SAME_PLACE_KM = 0.5;

/**
 * The geometry of a tour: its stops in travel order, laid out on the map plane.
 * A plan made from full stops can tell a visitor about each place; one made from
 * bare places is enough to draw the road.
 */
export class RoutePlan<P extends RoutePlace = Stop> {
  private constructor(readonly stops: readonly RouteStop<P>[]) {}

  static fromTour(tour: Tour, projection: MapProjection = TURKEY_PROJECTION): RoutePlan {
    return RoutePlan.fromStops(
      tour.days.flatMap((day) => day.stops.map((stop) => ({ stop, day: day.number }))),
      projection,
    );
  }

  /** Builds a plan from stops in travel order, each tagged with its day. */
  static fromStops<P extends RoutePlace>(
    visits: readonly { stop: P; day: number }[],
    projection: MapProjection = TURKEY_PROJECTION,
  ): RoutePlan<P> {
    const stops: RouteStop<P>[] = [];
    let travelled = 0;
    for (const { stop, day } of visits) {
      const previous = stops.at(-1);
      if (previous) travelled += previous.stop.location.distanceKmTo(stop.location);
      stops.push({
        index: stops.length,
        stop,
        day,
        point: projection.project(stop.location),
        distanceKm: travelled,
      });
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

  /**
   * Distance from a stop to the nearest stop that is somewhere else. Stops at
   * the same place (a town visited on two days) do not count as neighbours.
   */
  clearanceKm(stopIndex: number): number {
    const here = this.stops[stopIndex];
    if (!here) return Infinity;
    let nearest = Infinity;
    for (const other of this.stops) {
      const distance = Math.hypot(other.point.x - here.point.x, other.point.y - here.point.y);
      if (distance > SAME_PLACE_KM && distance < nearest) nearest = distance;
    }
    return nearest;
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
