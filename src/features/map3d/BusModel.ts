import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  type BufferGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { ToonKit } from './ToonKit';
import type { Disposable } from '@/shared/lifecycle';

const BODY = '#f6f5f0';
const STRIPE = '#0b5a8f';
const GLASS = '#22303c';
const TYRE = '#1f2328';
const LAMP = '#ffd66b';
const ROOF_UNIT = '#c9cdd1';

/**
 * A low-poly tour coach, one unit long with its nose along +X. It is built from
 * a handful of primitives so the site ships no model file.
 */
export class BusModel implements Disposable {
  readonly group = new Group();
  private readonly chassis = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly shadowMaterial = new MeshBasicMaterial({
    color: '#1b1f24',
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });

  constructor(kit: ToonKit) {
    const add = (
      geometry: BufferGeometry,
      color: string,
      x: number,
      y: number,
      z: number,
    ): void => {
      const mesh = new Mesh(this.track(geometry), kit.solid(color));
      mesh.position.set(x, y, z);
      this.chassis.add(mesh);
    };

    add(new RoundedBoxGeometry(1, 0.27, 0.3, 2, 0.05), BODY, 0, 0.215, 0);
    add(new BoxGeometry(1.006, 0.055, 0.306), STRIPE, 0, 0.13, 0);
    add(new BoxGeometry(0.8, 0.095, 0.308), GLASS, -0.04, 0.27, 0);
    add(new BoxGeometry(0.03, 0.13, 0.25), GLASS, 0.492, 0.25, 0);
    add(new BoxGeometry(0.32, 0.035, 0.18), ROOF_UNIT, -0.12, 0.365, 0);
    add(new BoxGeometry(0.012, 0.035, 0.05), LAMP, 0.503, 0.13, 0.1);
    add(new BoxGeometry(0.012, 0.035, 0.05), LAMP, 0.503, 0.13, -0.1);
    for (const x of [0.3, -0.32]) {
      const axle = new CylinderGeometry(0.068, 0.068, 0.33, 12);
      axle.rotateX(Math.PI / 2);
      add(axle, TYRE, x, 0.068, 0);
    }
    this.group.add(this.chassis);

    const shadow = new Mesh(this.track(new CircleGeometry(0.5, 20)), this.shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(1.25, 0.5, 1);
    shadow.position.y = 0.012;
    this.group.add(shadow);
  }

  /** Suspension bounce while the coach is moving; `motion` is 0 at rest and 1 at speed. */
  bounce(elapsedSeconds: number, motion: number): void {
    this.chassis.position.y = Math.sin(elapsedSeconds * 18) * 0.006 * motion;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    this.shadowMaterial.dispose();
  }

  private track<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }
}
