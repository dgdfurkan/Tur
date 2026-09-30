import {
  BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import type { RoutePlan } from '@/domain/tour/RoutePlan';
import { LAND_TOP, toWorld } from './world';
import type { Disposable } from '@/shared/lifecycle';

const SAMPLES_PER_SEGMENT = 28;
const MERGE_DISTANCE = 0.03;
const PLANNED_WIDTH = 0.22;
const CASING_WIDTH = 0.52;
const ACTIVE_WIDTH = 0.34;
const DASH_LENGTH = 0.9;

const PLANNED_COLOR = '#6f7a84';
const CASING_COLOR = '#ffffff';
const ACTIVE_COLOR = '#0b5a8f';

/**
 * The road a tour follows: a smooth curve through its stops, drawn as flat
 * ribbons on the land. The dashed ribbon shows the whole plan; the solid one is
 * revealed behind the coach as it travels.
 */
export class RouteTrack implements Disposable {
  readonly group = new Group();
  private readonly samples: Vector3[];
  /** Distance from the start to each sample, in world units. */
  private readonly cumulative: number[];
  /** Sample index at which each stop sits. */
  private readonly stopSample: number[];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshBasicMaterial[] = [];
  private readonly casing: BufferGeometry;
  private readonly active: BufferGeometry;

  constructor(plan: RoutePlan) {
    // Consecutive stops in the same spot (a sight and the hotel next to it)
    // would give the spline a zero-length segment, so they share one point.
    const points: Vector3[] = [];
    const pointOfStop: number[] = [];
    for (const stop of plan.stops) {
      const position = toWorld(stop.point, LAND_TOP);
      const last = points.at(-1);
      if (!last || last.distanceTo(position) > MERGE_DISTANCE) points.push(position);
      pointOfStop.push(points.length - 1);
    }
    const only = points[0];
    if (points.length === 1 && only) points.push(only.clone().setX(only.x + MERGE_DISTANCE));

    const curve = new CatmullRomCurve3(points, false, 'centripetal');
    this.samples = curve.getPoints((points.length - 1) * SAMPLES_PER_SEGMENT);
    this.cumulative = [0];
    for (let i = 1; i < this.samples.length; i += 1) {
      const from = this.samples[i - 1];
      const to = this.samples[i];
      const previous = this.cumulative[i - 1] ?? 0;
      this.cumulative.push(previous + (from && to ? from.distanceTo(to) : 0));
    }
    this.stopSample = pointOfStop.map((pointIndex) => pointIndex * SAMPLES_PER_SEGMENT);

    this.group.add(this.ribbon(PLANNED_WIDTH, 0.03, PLANNED_COLOR, true).mesh);
    const casing = this.ribbon(CASING_WIDTH, 0.045, CASING_COLOR, false);
    const active = this.ribbon(ACTIVE_WIDTH, 0.06, ACTIVE_COLOR, false);
    this.casing = casing.geometry;
    this.active = active.geometry;
    this.group.add(casing.mesh, active.mesh);
    this.reveal(0, 0);
  }

  get length(): number {
    return this.cumulative.at(-1) ?? 0;
  }

  /** Distance along the road for a point part-way through a leg. */
  distanceAt(legIndex: number, legProgress: number): number {
    const from = this.distanceOfStop(legIndex);
    const to = this.distanceOfStop(legIndex + 1);
    return from + (to - from) * Math.min(1, Math.max(0, legProgress));
  }

  /** Writes the position at a distance along the road into `target`. */
  positionAt(distance: number, target: Vector3): Vector3 {
    const { index, fraction } = this.locate(distance);
    const from = this.samples[index];
    const to = this.samples[index + 1] ?? from;
    if (!from || !to) return target;
    return target.lerpVectors(from, to, fraction);
  }

  /** Writes the direction of travel at a distance along the road into `target`. */
  directionAt(distance: number, target: Vector3): Vector3 {
    const { index } = this.locate(distance);
    // Looking a few samples ahead and behind smooths the heading through bends.
    const from = this.samples[Math.max(0, index - 2)];
    const to = this.samples[Math.min(this.samples.length - 1, index + 3)];
    if (!from || !to) return target.set(1, 0, 0);
    target.subVectors(to, from);
    return target.lengthSq() === 0 ? target.set(1, 0, 0) : target.normalize();
  }

  stopPosition(stopIndex: number, target: Vector3): Vector3 {
    const sample = this.samples[this.stopSample[stopIndex] ?? 0];
    return sample ? target.copy(sample) : target;
  }

  /** Shows the solid road from the start up to the coach. */
  reveal(legIndex: number, legProgress: number): void {
    const { index } = this.locate(this.distanceAt(legIndex, legProgress));
    // Six indices (two triangles) per road segment.
    const count = index * 6;
    this.casing.setDrawRange(0, count);
    this.active.setDrawRange(0, count);
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }

  private distanceOfStop(stopIndex: number): number {
    const clamped = Math.min(this.stopSample.length - 1, Math.max(0, stopIndex));
    return this.cumulative[this.stopSample[clamped] ?? 0] ?? 0;
  }

  /** Binary search for the road segment that contains a distance. */
  private locate(distance: number): { index: number; fraction: number } {
    const clamped = Math.min(this.length, Math.max(0, distance));
    let low = 0;
    let high = this.cumulative.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if ((this.cumulative[middle] ?? 0) <= clamped) low = middle;
      else high = middle;
    }
    const start = this.cumulative[low] ?? 0;
    const span = (this.cumulative[high] ?? start) - start;
    return { index: low, fraction: span === 0 ? 0 : (clamped - start) / span };
  }

  private ribbon(
    width: number,
    lift: number,
    color: string,
    dashed: boolean,
  ): { mesh: Mesh; geometry: BufferGeometry } {
    const positions: number[] = [];
    const indices: number[] = [];
    const side = new Vector3();
    const direction = new Vector3();
    this.samples.forEach((sample, i) => {
      this.directionAt(this.cumulative[i] ?? 0, direction);
      side.set(-direction.z, 0, direction.x).multiplyScalar(width / 2);
      positions.push(
        sample.x + side.x,
        sample.y + lift,
        sample.z + side.z,
        sample.x - side.x,
        sample.y + lift,
        sample.z - side.z,
      );
      if (i === this.samples.length - 1) return;
      const onDash = Math.floor((this.cumulative[i] ?? 0) / DASH_LENGTH) % 2 === 0;
      if (dashed && !onDash) return;
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    });

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    // Flat on the ground: nudge the depth so the ribbon never flickers against the land.
    const material = new MeshBasicMaterial({
      color,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.geometries.push(geometry);
    this.materials.push(material);
    return { mesh: new Mesh(geometry, material), geometry };
  }
}
