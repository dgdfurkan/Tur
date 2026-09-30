import { CircleGeometry, Group, Mesh, MeshBasicMaterial, type Vector3 } from 'three';
import type { Disposable } from '@/shared/lifecycle';

const PUFFS = 12;
const LIFETIME_SECONDS = 0.75;
const INTERVAL_SECONDS = 0.06;
const START_OPACITY = 0.5;
const COLOR = '#fff6e6';
const LIFT = 0.025;

interface Puff {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
  age: number;
  size: number;
}

/**
 * Dust kicked up behind the coach. On a map without landmarks nearby it is the
 * clearest sign that the coach is moving, and how fast.
 */
export class DustTrail implements Disposable {
  readonly group = new Group();
  private readonly geometry = new CircleGeometry(0.11, 12);
  private readonly puffs: Puff[];
  private sinceLast = 0;
  private next = 0;

  constructor() {
    this.geometry.rotateX(-Math.PI / 2);
    this.puffs = Array.from({ length: PUFFS }, () => {
      const material = new MeshBasicMaterial({
        color: COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new Mesh(this.geometry, material);
      mesh.visible = false;
      this.group.add(mesh);
      return { mesh, material, age: LIFETIME_SECONDS, size: 1 };
    });
  }

  /**
   * Ages the puffs and, while the coach is moving, leaves a new one at its rear.
   * @param rear Where the back of the coach is.
   * @param size The coach's scale, so the dust matches it at any zoom.
   */
  update(deltaSeconds: number, moving: boolean, rear: Vector3, size: number): void {
    for (const puff of this.puffs) {
      if (puff.age >= LIFETIME_SECONDS) continue;
      puff.age += deltaSeconds;
      const life = Math.min(1, puff.age / LIFETIME_SECONDS);
      puff.mesh.visible = life < 1;
      puff.mesh.scale.setScalar(puff.size * (0.7 + life * 1.6));
      puff.material.opacity = START_OPACITY * (1 - life) ** 2;
    }

    this.sinceLast += deltaSeconds;
    if (!moving || this.sinceLast < INTERVAL_SECONDS) return;
    this.sinceLast = 0;
    const puff = this.puffs[this.next];
    this.next = (this.next + 1) % this.puffs.length;
    if (!puff) return;
    puff.age = 0;
    puff.size = size;
    puff.mesh.position.set(rear.x, rear.y + LIFT, rear.z);
    puff.mesh.visible = true;
  }

  /** Clears the air at once, for when the coach is moved rather than driven. */
  settle(): void {
    for (const puff of this.puffs) {
      puff.age = LIFETIME_SECONDS;
      puff.mesh.visible = false;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    for (const puff of this.puffs) puff.material.dispose();
  }
}
