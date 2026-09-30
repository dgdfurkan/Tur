import {
  CanvasTexture,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  type BufferGeometry,
} from 'three';
import type { LandTexture } from './LandTexture';
import type { MapData, Ring } from './MapData';
import type { ToonKit } from './ToonKit';
import { KM_PER_UNIT, LAND_TOP } from './world';
import type { Disposable } from '@/shared/lifecycle';

const SEA_COLOR = '#a8d3ea';
const CLIFF_COLOR = '#b89b6a';
const BEVEL = 0.06;
/** Open sea beyond the painted surroundings; large enough to reach the fog. */
const SEA_SIZE = 1400;
const SURROUNDINGS_LIFT = 0.02;
/** World units one detail tile covers before it repeats. */
const DETAIL_TILE = 3;

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

/** The two paintings the board wears; they are made beforehand so the work can be spread out. */
export interface BoardTextures {
  readonly surroundings: HTMLCanvasElement;
  readonly land: LandTexture;
  /** A repeating tile of fine marks laid over the land painting. */
  readonly detail: HTMLCanvasElement;
  readonly anisotropy: number;
}

/**
 * The static map: open sea, a painted plane of coastal water and neighbouring
 * land, and Turkey as a raised, bevelled slab whose top carries the land painting.
 */
export class TurkeyBoard implements Disposable {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly textures: CanvasTexture[] = [];
  private readonly landMaterial: MeshBasicMaterial;
  private readonly seaMaterial: MeshBasicMaterial;
  private readonly surroundingsMaterial: MeshBasicMaterial;

  constructor(data: MapData, kit: ToonKit, textures: BoardTextures) {
    this.seaMaterial = new MeshBasicMaterial({ color: SEA_COLOR });
    const sea = new Mesh(this.track(new PlaneGeometry(SEA_SIZE, SEA_SIZE)), this.seaMaterial);
    sea.rotation.x = -Math.PI / 2;
    this.group.add(sea);

    // Neighbouring land and the coastal shallows are a painting laid on the sea.
    const { bounds } = data;
    const surroundings = this.texture(textures.surroundings, textures.anisotropy);
    this.surroundingsMaterial = new MeshBasicMaterial({ map: surroundings });
    const frame = new Mesh(
      this.track(
        new PlaneGeometry(
          (bounds.maxX - bounds.minX) / KM_PER_UNIT,
          (bounds.maxY - bounds.minY) / KM_PER_UNIT,
        ),
      ),
      this.surroundingsMaterial,
    );
    frame.rotation.x = -Math.PI / 2;
    frame.position.set(
      (bounds.minX + bounds.maxX) / 2 / KM_PER_UNIT,
      SURROUNDINGS_LIFT,
      -(bounds.minY + bounds.maxY) / 2 / KM_PER_UNIT,
    );
    this.group.add(frame);

    const { land } = textures;
    const landTexture = this.texture(land.canvas, textures.anisotropy);
    // ExtrudeGeometry writes the cap's UVs in shape units; map them onto the painting.
    const width = land.extent.width / KM_PER_UNIT;
    const height = land.extent.height / KM_PER_UNIT;
    landTexture.repeat.set(1 / width, 1 / height);
    landTexture.offset.set(
      -land.extent.minX / KM_PER_UNIT / width,
      -land.extent.minY / KM_PER_UNIT / height,
    );

    const detail = this.texture(textures.detail, textures.anisotropy);
    detail.wrapS = RepeatWrapping;
    detail.wrapT = RepeatWrapping;
    detail.repeat.set(1 / DETAIL_TILE, 1 / DETAIL_TILE);
    // Used as an occlusion map, the tile multiplies the painting underneath.
    this.landMaterial = new MeshBasicMaterial({ map: landTexture, aoMap: detail });
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
  }

  /** Multiplies the unlit surfaces so they follow the time of day like the lit ones. */
  setTint(tint: { r: number; g: number; b: number }): void {
    this.landMaterial.color.setRGB(tint.r, tint.g, tint.b);
    this.surroundingsMaterial.color.copy(this.landMaterial.color);
    this.seaMaterial.color.set(SEA_COLOR).multiply(this.landMaterial.color);
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const texture of this.textures) texture.dispose();
    this.landMaterial.dispose();
    this.seaMaterial.dispose();
    this.surroundingsMaterial.dispose();
  }

  private texture(canvas: HTMLCanvasElement, anisotropy: number): CanvasTexture {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = anisotropy;
    this.textures.push(texture);
    return texture;
  }

  /** The textures, for uploading to the GPU ahead of the first frame. */
  get paintings(): readonly CanvasTexture[] {
    return this.textures;
  }

  private track<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }
}
