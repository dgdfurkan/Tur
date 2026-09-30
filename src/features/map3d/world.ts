import { MathUtils, Vector3 } from 'three';
import type { PlanePoint } from '@/domain/geo/MapProjection';

/** One world unit spans ten kilometres; Turkey is about 160 units wide. */
export const KM_PER_UNIT = 10;

/** Height of the land surface above the sea. The slab is a game-board piece, not terrain. */
export const LAND_TOP = 0.7;

/** Sizes of the symbols drawn on the map, in world units at scale 1. */
export const COACH_LENGTH = 1;
export const MARKER_RADIUS = 0.34;
export const ROAD_WIDTH = 0.52;

/** How the camera sees the map at the moment. */
export interface MapView {
  /** Distance from the camera to the point it looks at, in world units. */
  readonly distance: number;
  /** World units covered by one CSS pixel at that point. */
  readonly unitsPerPixel: number;
}

/** Closer than this, symbols stop growing on screen so that neighbouring stops stay apart. */
const CLOSE_UP_DISTANCE = 12;

/** Smallest size on screen in CSS pixels, however far the camera pulls back. */
const MIN_COACH_PIXELS = 22;
const MIN_MARKER_PIXELS = 3.5;
const MIN_ROAD_PIXELS = 5;

/** Map plane (east +x, north +y, km) to world space (east +x, up +y, north -z). */
export function toWorld(point: PlanePoint, height = LAND_TOP): Vector3 {
  return new Vector3(point.x / KM_PER_UNIT, height, -point.y / KM_PER_UNIT);
}

function closeUp(view: MapView): number {
  return Math.min(1, view.distance / CLOSE_UP_DISTANCE);
}

/**
 * Coaches, stop markers and roads are symbols rather than scenery: they hold a
 * readable size on screen whatever the zoom, so their world size follows the camera.
 */
export function coachScale(view: MapView): number {
  const scale = MathUtils.clamp(view.distance * 0.045, 0.9 * closeUp(view), 6);
  return Math.max(scale, (MIN_COACH_PIXELS * view.unitsPerPixel) / COACH_LENGTH);
}

export function markerScale(view: MapView): number {
  const scale = MathUtils.clamp(view.distance * 0.022, 0.8 * closeUp(view), 3.4);
  return Math.max(scale, (MIN_MARKER_PIXELS * view.unitsPerPixel) / MARKER_RADIUS);
}

/**
 * At middle distances a road keeps its world width and reads as something the
 * coach drives on; from far away it is held wide enough to stay a visible line.
 */
export function roadScale(view: MapView): number {
  return Math.max(closeUp(view), (MIN_ROAD_PIXELS * view.unitsPerPixel) / ROAD_WIDTH);
}
