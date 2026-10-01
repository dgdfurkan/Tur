import { GeoPoint } from '@/domain/geo/GeoPoint';
import { RoutePlan, type RoutePlace } from '@/domain/tour/RoutePlan';
import type { StopKind, Tour } from '@/domain/tour/Tour';

/**
 * The bare geometry of a tour's route: enough to draw it on a map, and small
 * enough to fetch for every tour at once.
 */
export interface RouteOutline {
  id: string;
  title: string;
  stops: { name: string; kind: StopKind; lat: number; lon: number }[];
}

export function toRouteOutline(tour: Tour): RouteOutline {
  return {
    id: tour.id,
    title: tour.title,
    stops: tour.stops.map((stop) => ({
      name: stop.name,
      kind: stop.kind,
      lat: stop.location.lat,
      lon: stop.location.lon,
    })),
  };
}

export function toRoutePlan(outline: RouteOutline): RoutePlan<RoutePlace> {
  return RoutePlan.fromStops(
    outline.stops.map((stop) => ({
      day: 1,
      stop: { name: stop.name, kind: stop.kind, location: new GeoPoint(stop.lat, stop.lon) },
    })),
  );
}
