import {
  CanvasTexture,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
} from 'three';
import { LandTexture } from './LandTexture';
import type { MapData, Ring } from './MapData';
import type { ToonKit } from './ToonKit';
import { KM_PER_UNIT, LAND_TOP } from './world';
import type { Disposable } from '@/shared/lifecycle';

const SEA_COLOR = '#a8d3ea';
const NEIGHBOUR_COLOR = '#e3e5d8';
const CLIFF_COLOR = '#b89b6a';
const NEIGHBOUR_HEIGHT = 0.28;
const BEVEL = 0.06;
const SEA_SIZE = 900;

function toShapes(rings: readonly Ring[]): Shape[] {
  return rings.map((ring) => {
    const shape = new Shape();
    ring.forEach(([x, y], index) => {
      if (index === 0) shape.moveTo(x / KM_PER_UNIT, y / KM_PER_UNIT);
      else shape.lineTo(x / KM_PER_UNIT, y / KM_PER_UNIT);
    });
    shape.closePath();
    return shape;
  });
}

/** Shapes live in the XY plane and extrude along +Z; this lays them flat with +Y up. */
function layFlat<T extends BufferGeometry>(geometry: T): T {
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export interface BoardOptions {
  readonly texturePixels: number;
  readonly anisotropy: number;
}

/**
 * The static map: sea, neighbouring land and Turkey as a raised, bevelled slab
 * whose top carries the painted land texture.
 */
export class TurkeyBoard implements Disposable {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly ownMaterials: Material[] = [];
  private readonly texture: CanvasTexture;
  private readonly landMaterial: MeshBasicMaterial;
  private readonly seaMaterial: MeshBasicMaterial;

  constructor(data: MapData, kit: ToonKit, options: BoardOptions) {
    this.seaMaterial = new MeshBasicMaterial({ color: SEA_COLOR });
    const sea = new Mesh(this.track(new PlaneGeometry(SEA_SIZE, SEA_SIZE)), this.seaMaterial);
    sea.rotation.x = -Math.PI / 2;
    this.group.add(sea);

    const neighbours = layFlat(
      new ExtrudeGeometry(toShapes(data.neighbours), {
        depth: NEIGHBOUR_HEIGHT,
        bevelEnabled: false,
      }),
    );
    this.group.add(new Mesh(this.track(neighbours), kit.solid(NEIGHBOUR_COLOR)));

    const land = new LandTexture(data, options.texturePixels);
    this.texture = new CanvasTexture(land.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = options.anisotropy;
    // ExtrudeGeometry writes the cap's UVs in shape units; map them onto the painting.
    const width = land.extent.width / KM_PER_UNIT;
    const height = land.extent.height / KM_PER_UNIT;
    this.texture.repeat.set(1 / width, 1 / height);
    this.texture.offset.set(
      -land.extent.minX / KM_PER_UNIT / width,
      -land.extent.minY / KM_PER_UNIT / height,
    );

    this.landMaterial = new MeshBasicMaterial({ map: this.texture });
    const slab = layFlat(
      new ExtrudeGeometry(toShapes(data.turkey), {
        depth: LAND_TOP - BEVEL,
        bevelEnabled: true,
        bevelThickness: BEVEL,
        bevelSize: BEVEL,
        bevelSegments: 1,
      }),
    );
    this.group.add(new Mesh(this.track(slab), [this.landMaterial, kit.solid(CLIFF_COLOR)]));

    this.ownMaterials.push(this.seaMaterial, this.landMaterial);
  }

  /** Multiplies the unlit surfaces so they follow the time of day like the lit ones. */
  setTint(tint: { r: number; g: number; b: number }): void {
    this.landMaterial.color.setRGB(tint.r, tint.g, tint.b);
    this.seaMaterial.color.set(SEA_COLOR).multiply(this.landMaterial.color);
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.ownMaterials) material.dispose();
    this.texture.dispose();
  }

  private track<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }
}
