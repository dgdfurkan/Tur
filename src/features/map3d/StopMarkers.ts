import {
  CircleGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
  Vector3,
} from 'three';
import type { RoutePlace, RoutePlan } from '@/domain/tour/RoutePlan';
import type { StopKind } from '@/domain/tour/Tour';
import type { RouteTrack } from './RouteTrack';
import { MARKER_RADIUS } from './world';
import type { Disposable } from '@/shared/lifecycle';

const KIND_COLOR: Record<StopKind, string> = {
  departure: '#0b5a8f',
  arrival: '#0b5a8f',
  sight: '#74462a',
  rest: '#56606b',
  lodging: '#1b1f24',
};

const LIFT = 0.09;
/** Radius of the coloured centre as a share of the whole marker. */
const CORE_SHARE = 0.68;

/**
 * Discs on the road that mark each stop, tinted like the programme's timeline:
 * brown for sights, blue for the terminus. A ring pulses around the active stop.
 */
export class StopMarkers implements Disposable {
  readonly group = new Group();
  private readonly rims: InstancedMesh;
  private readonly cores: InstancedMesh;
  private readonly pulse: Mesh;
  private readonly positions: Vector3[];
  private readonly dummy = new Object3D();
  private readonly materials: MeshBasicMaterial[];
  private readonly pulseMaterial: MeshBasicMaterial;
  private scale = 1;
  private activeIndex: number | null = null;

  constructor(plan: RoutePlan<RoutePlace>, track: RouteTrack) {
    const rimMaterial = new MeshBasicMaterial({ color: '#ffffff' });
    const coreMaterial = new MeshBasicMaterial({ color: '#ffffff' });
    this.pulseMaterial = new MeshBasicMaterial({
      color: '#f2b705',
      transparent: true,
      depthWrite: false,
    });
    this.materials = [rimMaterial, coreMaterial, this.pulseMaterial];

    const count = plan.stops.length;
    this.positions = plan.stops.map((stop) => track.stopPosition(stop.index, new Vector3()));
    this.rims = new InstancedMesh(new CircleGeometry(MARKER_RADIUS, 20), rimMaterial, count);
    this.cores = new InstancedMesh(
      new CircleGeometry(MARKER_RADIUS * CORE_SHARE, 20),
      coreMaterial,
      count,
    );
    this.rims.instanceMatrix.setUsage(DynamicDrawUsage);
    this.cores.instanceMatrix.setUsage(DynamicDrawUsage);
    const color = new Color();
    plan.stops.forEach((stop, index) => {
      this.cores.setColorAt(index, color.set(KIND_COLOR[stop.stop.kind]));
    });

    this.pulse = new Mesh(
      new RingGeometry(MARKER_RADIUS * 1.18, MARKER_RADIUS * 1.53, 28),
      this.pulseMaterial,
    );
    this.pulse.visible = false;
    this.pulse.rotation.x = -Math.PI / 2;
    this.group.add(this.rims, this.cores, this.pulse);
    this.layout();
  }

  /** Markers keep a readable size on screen, so they grow as the camera pulls back. */
  setScale(scale: number): void {
    if (Math.abs(scale - this.scale) < 0.02) return;
    this.scale = scale;
    this.layout();
  }

  setActive(stopIndex: number | null): void {
    this.activeIndex = stopIndex;
    const position = stopIndex === null ? undefined : this.positions[stopIndex];
    this.pulse.visible = position !== undefined;
    if (position) this.pulse.position.set(position.x, position.y + LIFT + 0.004, position.z);
  }

  update(elapsedSeconds: number): void {
    if (this.activeIndex === null) return;
    const wave = (elapsedSeconds * 0.9) % 1;
    this.pulse.scale.setScalar(this.scale * (1 + wave * 1.2));
    this.pulseMaterial.opacity = 0.75 * (1 - wave);
  }

  dispose(): void {
    this.rims.geometry.dispose();
    this.cores.geometry.dispose();
    this.pulse.geometry.dispose();
    this.rims.dispose();
    this.cores.dispose();
    for (const material of this.materials) material.dispose();
  }

  private layout(): void {
    this.positions.forEach((position, index) => {
      this.dummy.rotation.set(-Math.PI / 2, 0, 0);
      this.dummy.scale.setScalar(this.scale);
      this.dummy.position.set(position.x, position.y + LIFT, position.z);
      this.dummy.updateMatrix();
      this.rims.setMatrixAt(index, this.dummy.matrix);
      this.dummy.position.y += 0.006;
      this.dummy.updateMatrix();
      this.cores.setMatrixAt(index, this.dummy.matrix);
    });
    this.rims.instanceMatrix.needsUpdate = true;
    this.cores.instanceMatrix.needsUpdate = true;
  }
}
