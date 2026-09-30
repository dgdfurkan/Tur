import { Color, DynamicDrawUsage, Group, InstancedMesh, Object3D } from 'three';
import { TURKEY_PROJECTION, type GeoCoordinates } from '@/domain/geo/MapProjection';
import type { LandmarkFactory, LandmarkKind } from './LandmarkFactory';
import { mapData, ringsContain } from './MapData';
import { PEAKS } from './places';
import { createRandom } from './random';
import type { ToonKit } from './ToonKit';
import { KM_PER_UNIT, toWorld } from './world';
import type { Disposable, Updatable } from '@/shared/lifecycle';

interface Placement {
  readonly location: GeoCoordinates;
  readonly scale: number;
  /** Height relative to width; peaks vary it so the ranges are not uniform. */
  readonly stretch: number;
}

interface Region {
  readonly lat: readonly [number, number];
  readonly lon: readonly [number, number];
  readonly count: number;
  readonly scale: readonly [number, number];
}

interface Cluster extends GeoCoordinates {
  readonly radiusKm: number;
  readonly count: number;
  readonly scale: readonly [number, number];
}

const FORESTS: readonly Region[] = [
  { lat: [40.75, 41.85], lon: [30.6, 41.8], count: 320, scale: [0.4, 0.75] },
  { lat: [39.6, 40.7], lon: [26.8, 31.2], count: 90, scale: [0.4, 0.7] },
  { lat: [37.0, 39.4], lon: [27.2, 29.8], count: 110, scale: [0.35, 0.65] },
  { lat: [36.3, 37.3], lon: [28.4, 36.4], count: 130, scale: [0.4, 0.7] },
  { lat: [41.0, 42.0], lon: [26.2, 28.6], count: 40, scale: [0.4, 0.65] },
];

const RANGES: readonly Region[] = [
  { lat: [36.7, 37.6], lon: [30.0, 36.0], count: 26, scale: [0.45, 0.95] },
  { lat: [40.5, 41.0], lon: [33.0, 41.5], count: 22, scale: [0.4, 0.8] },
  { lat: [38.2, 40.6], lon: [38.5, 44.0], count: 34, scale: [0.45, 1.0] },
  { lat: [38.0, 39.6], lon: [28.5, 30.5], count: 8, scale: [0.4, 0.6] },
];

const CLUSTERS: Readonly<Record<'chimney' | 'house' | 'column', readonly Cluster[]>> = {
  chimney: [{ lat: 38.655, lon: 34.84, radiusKm: 13, count: 16, scale: [0.4, 0.75] }],
  house: [
    { lat: 41.25, lon: 32.69, radiusKm: 6, count: 6, scale: [0.55, 0.75] },
    { lat: 40.168, lon: 31.92, radiusKm: 5, count: 5, scale: [0.55, 0.75] },
    { lat: 41.748, lon: 32.386, radiusKm: 3, count: 3, scale: [0.5, 0.65] },
    { lat: 37.943, lon: 27.433, radiusKm: 3, count: 3, scale: [0.5, 0.65] },
  ],
  column: [
    { lat: 37.941, lon: 27.342, radiusKm: 0, count: 1, scale: [1.1, 1.1] },
    { lat: 37.927, lon: 29.127, radiusKm: 0, count: 1, scale: [1, 1] },
    { lat: 38.488, lon: 28.04, radiusKm: 0, count: 1, scale: [1, 1] },
    { lat: 39.65, lon: 31.98, radiusKm: 0, count: 1, scale: [1, 1] },
    { lat: 39.13, lon: 27.18, radiusKm: 0, count: 1, scale: [1, 1] },
    { lat: 36.94, lon: 31.17, radiusKm: 0, count: 1, scale: [1, 1] },
  ],
};

const BALLOON_HOME: GeoCoordinates = { lat: 38.65, lon: 34.85 };
const BALLOON_TINTS = ['#e4572e', '#f2b705', '#2a9d8f', '#0b5a8f', '#c0161c', '#f4a261', '#8e5ea2'];
const KM_PER_DEGREE = 111;

interface Balloon {
  readonly x: number;
  readonly z: number;
  readonly altitude: number;
  readonly phase: number;
  readonly scale: number;
}

/** Trees, mountains and landmarks: static instanced meshes, plus a few drifting balloons. */
export class Scenery implements Disposable, Updatable {
  readonly group = new Group();
  private readonly meshes: InstancedMesh[] = [];
  private readonly balloons: Balloon[] = [];
  private readonly balloonMesh: InstancedMesh;
  private readonly dummy = new Object3D();
  private readonly random = createRandom(2026);

  constructor(factory: LandmarkFactory, kit: ToonKit, density: number) {
    const material = kit.vertexColors();
    const build = (kind: LandmarkKind, placements: readonly Placement[]): void => {
      if (placements.length === 0) return;
      const mesh = new InstancedMesh(factory.geometry(kind), material, placements.length);
      placements.forEach((placement, index) => {
        this.dummy.position.copy(toWorld(TURKEY_PROJECTION.project(placement.location)));
        this.dummy.rotation.set(0, this.random() * Math.PI * 2, 0);
        this.dummy.scale.set(placement.scale, placement.scale * placement.stretch, placement.scale);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(index, this.dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.meshes.push(mesh);
      this.group.add(mesh);
    };

    build('pine', this.scatter(FORESTS, density));
    build('peak', [
      ...PEAKS.map((peak) => ({
        location: peak,
        scale: (peak.heightM / 1000) * 0.3,
        stretch: 1.25,
      })),
      // Ranges keep most of their peaks even on weak devices; they define the skyline.
      ...this.scatter(RANGES, Math.max(0.6, density)),
    ]);
    for (const kind of ['chimney', 'house', 'column'] as const) {
      build(kind, this.cluster(CLUSTERS[kind]));
    }

    this.balloonMesh = new InstancedMesh(
      factory.geometry('balloon'),
      material,
      BALLOON_TINTS.length,
    );
    this.balloonMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    const home = toWorld(TURKEY_PROJECTION.project(BALLOON_HOME));
    BALLOON_TINTS.forEach((tint, index) => {
      const angle = this.random() * Math.PI * 2;
      const distance = (4 + this.random() * 16) / KM_PER_UNIT;
      this.balloons.push({
        x: home.x + Math.cos(angle) * distance,
        z: home.z + Math.sin(angle) * distance,
        altitude: 1.3 + this.random() * 2,
        phase: this.random() * Math.PI * 2,
        scale: 0.55 + this.random() * 0.3,
      });
      this.balloonMesh.setColorAt(index, new Color(tint));
    });
    this.group.add(this.balloonMesh);
    this.update(0, 0);
  }

  /** Balloons bob and sway slowly; everything else is static. */
  update(_deltaSeconds: number, elapsedSeconds: number): void {
    this.balloons.forEach((balloon, index) => {
      const t = elapsedSeconds * 0.5 + balloon.phase;
      this.dummy.position.set(
        balloon.x + Math.sin(t * 0.6) * 0.12,
        bob(balloon.altitude, t),
        balloon.z + Math.cos(t * 0.5) * 0.12,
      );
      this.dummy.rotation.set(0, t * 0.2, 0);
      this.dummy.scale.setScalar(balloon.scale);
      this.dummy.updateMatrix();
      this.balloonMesh.setMatrixAt(index, this.dummy.matrix);
    });
    this.balloonMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [...this.meshes, this.balloonMesh]) mesh.dispose();
  }

  private scatter(regions: readonly Region[], density: number): Placement[] {
    const placements: Placement[] = [];
    for (const region of regions) {
      const wanted = Math.round(region.count * density);
      // Rejection sampling: a region's rectangle overlaps the sea, so draw until enough land hits.
      for (let tries = 0, placed = 0; placed < wanted && tries < wanted * 8; tries += 1) {
        const location = {
          lat: this.between(region.lat),
          lon: this.between(region.lon),
        };
        if (!this.isOnLand(location)) continue;
        placements.push({
          location,
          scale: this.between(region.scale),
          stretch: 0.8 + this.random() * 0.5,
        });
        placed += 1;
      }
    }
    return placements;
  }

  private cluster(clusters: readonly Cluster[]): Placement[] {
    return clusters.flatMap((cluster) =>
      Array.from({ length: cluster.count }, () => {
        const angle = this.random() * Math.PI * 2;
        const distance = Math.sqrt(this.random()) * cluster.radiusKm;
        return {
          location: {
            lat: cluster.lat + (Math.sin(angle) * distance) / KM_PER_DEGREE,
            lon: cluster.lon + (Math.cos(angle) * distance) / (KM_PER_DEGREE * 0.78),
          },
          scale: this.between(cluster.scale),
          stretch: 0.85 + this.random() * 0.4,
        };
      }),
    );
  }

  private between(range: readonly [number, number]): number {
    return range[0] + this.random() * (range[1] - range[0]);
  }

  private isOnLand(location: GeoCoordinates): boolean {
    const plane = TURKEY_PROJECTION.project(location);
    return ringsContain(mapData.turkeyCoarse, plane.x, plane.y);
  }
}

function bob(altitude: number, t: number): number {
  return altitude + Math.sin(t) * 0.18;
}
