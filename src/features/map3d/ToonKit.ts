import {
  Color,
  DataTexture,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  type ColorRepresentation,
} from 'three';
import type { Disposable } from '@/shared/lifecycle';

/**
 * Cel-shading materials that share one stepped gradient, so every object in
 * the scene is lit in the same few flat bands and reads as a drawing.
 */
export class ToonKit implements Disposable {
  private readonly gradient: DataTexture;
  private readonly solids = new Map<string, MeshToonMaterial>();
  private vertexColored: MeshToonMaterial | undefined;

  constructor() {
    this.gradient = new DataTexture(new Uint8Array([120, 185, 230, 255]), 4, 1, RedFormat);
    this.gradient.minFilter = NearestFilter;
    this.gradient.magFilter = NearestFilter;
    this.gradient.needsUpdate = true;
  }

  solid(color: ColorRepresentation): MeshToonMaterial {
    const key = new Color(color).getHexString();
    let material = this.solids.get(key);
    if (!material) {
      material = new MeshToonMaterial({ color, gradientMap: this.gradient });
      this.solids.set(key, material);
    }
    return material;
  }

  /** For geometry that carries its own per-vertex palette. */
  vertexColors(): MeshToonMaterial {
    this.vertexColored ??= new MeshToonMaterial({ vertexColors: true, gradientMap: this.gradient });
    return this.vertexColored;
  }

  dispose(): void {
    for (const material of this.solids.values()) material.dispose();
    this.solids.clear();
    this.vertexColored?.dispose();
    this.gradient.dispose();
  }
}
