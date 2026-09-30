import { Vector3 } from 'three';
import type { PlanePoint } from '@/domain/geo/MapProjection';

/** One world unit spans ten kilometres; Turkey is about 160 units wide. */
export const KM_PER_UNIT = 10;

/** Height of the land surface above the sea. The slab is a game-board piece, not terrain. */
export const LAND_TOP = 0.7;

/** Map plane (east +x, north +y, km) to world space (east +x, up +y, north -z). */
export function toWorld(point: PlanePoint, height = LAND_TOP): Vector3 {
  return new Vector3(point.x / KM_PER_UNIT, height, -point.y / KM_PER_UNIT);
}
