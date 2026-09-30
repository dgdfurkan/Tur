import {
  BoxGeometry,
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  LatheGeometry,
  Vector2,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRandom } from './random';
import type { Disposable } from '@/shared/lifecycle';

export type LandmarkKind = 'peak' | 'pine' | 'chimney' | 'balloon' | 'house' | 'column';

type Builder = () => BufferGeometry;
type Painter = (x: number, y: number, z: number, vertexIndex: number) => string;

/** Gives every face its own vertices and normals (a faceted, hand-cut look) and a vertex palette. */
function facet(geometry: BufferGeometry, painter: Painter): BufferGeometry {
  const faceted = geometry.index ? geometry.toNonIndexed() : geometry;
  if (faceted !== geometry) geometry.dispose();
  faceted.computeVertexNormals();
  const position = faceted.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const color = new Color();
  for (let i = 0; i < position.count; i += 1) {
    color.set(painter(position.getX(i), position.getY(i), position.getZ(i), i));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  faceted.setAttribute('color', new BufferAttribute(colors, 3));
  faceted.deleteAttribute('uv');
  return faceted;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

function buildPeak(): BufferGeometry {
  const cone = new ConeGeometry(1, 1, 8, 4, true);
  cone.translate(0, 0.5, 0);
  // Nudge the rings so no two slopes are alike; the tip and base stay put.
  const random = createRandom(11);
  const position = cone.getAttribute('position');
  const offsets = new Map<string, [number, number]>();
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    if (y < 0.05 || y > 0.95) continue;
    const key = `${position.getX(i).toFixed(3)}:${y.toFixed(3)}:${position.getZ(i).toFixed(3)}`;
    let offset = offsets.get(key);
    if (!offset) {
      offset = [(random() - 0.5) * 0.16, (random() - 0.5) * 0.16];
      offsets.set(key, offset);
    }
    position.setX(i, position.getX(i) + offset[0]);
    position.setZ(i, position.getZ(i) + offset[1]);
  }
  return facet(cone, (_x, y) => (y > 0.72 ? '#ffffff' : y > 0.34 ? '#a3987f' : '#8fa371'));
}

function buildPine(): BufferGeometry {
  const trunk = new CylinderGeometry(0.06, 0.08, 0.3, 5);
  trunk.translate(0, 0.15, 0);
  const lower = new ConeGeometry(0.34, 0.62, 6);
  lower.translate(0, 0.55, 0);
  const upper = new ConeGeometry(0.24, 0.52, 6);
  upper.translate(0, 0.92, 0);
  return merge([
    facet(trunk, () => '#7a5a3c'),
    facet(lower, () => '#3f7d4a'),
    facet(upper, () => '#4f9458'),
  ]);
}

function buildChimney(): BufferGeometry {
  const body = new CylinderGeometry(0.2, 0.36, 1, 6);
  body.translate(0, 0.5, 0);
  const cap = new ConeGeometry(0.34, 0.52, 6);
  cap.translate(0, 1.22, 0);
  return merge([facet(body, () => '#ecd3b2'), facet(cap, () => '#9a7758')]);
}

function buildBalloon(): BufferGeometry {
  const profile = [
    [0.001, 0.1],
    [0.13, 0.14],
    [0.4, 0.46],
    [0.52, 0.8],
    [0.44, 1.12],
    [0.22, 1.32],
    [0.001, 1.38],
  ].map(([radius, height]) => new Vector2(radius, height));
  const gores = 8;
  const envelope = new LatheGeometry(profile, gores);
  const basket = new BoxGeometry(0.17, 0.12, 0.17);
  basket.translate(0, -0.02, 0);
  // Alternate gores are shaded so a per-instance tint yields two-tone stripes.
  const angleStep = (Math.PI * 2) / gores;
  return merge([
    facet(envelope, (x, _y, z) => {
      const gore = Math.floor(
        ((Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2)) / angleStep + 0.001,
      );
      return gore % 2 === 0 ? '#ffffff' : '#c9c9c9';
    }),
    facet(basket, () => '#5a4636'),
  ]);
}

function buildHouse(): BufferGeometry {
  const ground = new BoxGeometry(0.5, 0.3, 0.4);
  ground.translate(0, 0.15, 0);
  const upper = new BoxGeometry(0.58, 0.22, 0.48);
  upper.translate(0, 0.41, 0);
  const roof = new ConeGeometry(0.5, 0.26, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(0, 0.65, 0);
  return merge([
    facet(ground, () => '#e9dfc9'),
    facet(upper, () => '#f7f1e3'),
    facet(roof, () => '#b8553d'),
  ]);
}

function buildColumn(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (const x of [-0.24, 0, 0.24]) {
    const shaft = new CylinderGeometry(0.06, 0.075, 0.66, 6);
    shaft.translate(x, 0.33, 0);
    parts.push(facet(shaft, () => '#f1ece0'));
  }
  const lintel = new BoxGeometry(0.66, 0.09, 0.2);
  lintel.translate(0, 0.705, 0);
  parts.push(facet(lintel, () => '#e6dfcf'));
  const base = new BoxGeometry(0.72, 0.06, 0.26);
  base.translate(0, 0.03, 0);
  parts.push(facet(base, () => '#d9d1bf'));
  return merge(parts);
}

/**
 * Builds the low-poly models that decorate the map. New kinds are added by
 * registering a builder; nothing that consumes the factory has to change.
 */
export class LandmarkFactory implements Disposable {
  private readonly builders = new Map<LandmarkKind, Builder>([
    ['peak', buildPeak],
    ['pine', buildPine],
    ['chimney', buildChimney],
    ['balloon', buildBalloon],
    ['house', buildHouse],
    ['column', buildColumn],
  ]);
  private readonly cache = new Map<LandmarkKind, BufferGeometry>();

  register(kind: LandmarkKind, builder: Builder): void {
    this.builders.set(kind, builder);
    this.cache.get(kind)?.dispose();
    this.cache.delete(kind);
  }

  /** One shared geometry per kind, built on first use; every model stands on y = 0. */
  geometry(kind: LandmarkKind): BufferGeometry {
    let geometry = this.cache.get(kind);
    if (!geometry) {
      const builder = this.builders.get(kind);
      if (!builder) throw new Error(`No landmark builder registered for "${kind}"`);
      geometry = builder();
      this.cache.set(kind, geometry);
    }
    return geometry;
  }

  dispose(): void {
    for (const geometry of this.cache.values()) geometry.dispose();
    this.cache.clear();
  }
}
