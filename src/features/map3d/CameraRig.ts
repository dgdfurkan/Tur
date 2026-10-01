import { MathUtils, Vector2, Vector3, type PerspectiveCamera } from 'three';
import type { MapView } from './world';
import type { Updatable, ViewPadding } from '@/shared/lifecycle';

export interface CameraPose {
  readonly target: Vector3;
  readonly distance: number;
  /** Elevation above the ground in degrees. */
  readonly pitch: number;
}

const AZIMUTH = MathUtils.degToRad(9);
const RESPONSE = 3.8;
const FRAME_MARGIN = 1.22;
const NO_PADDING: ViewPadding = { left: 0, right: 0, top: 0, bottom: 0 };

/**
 * Moves the camera between poses with exponential damping. Callers set where
 * the camera should be; the rig gets there smoothly and can be interrupted at
 * any moment without a jump.
 */
export class CameraRig implements Updatable {
  private readonly target = new Vector3();
  private readonly wantedTarget = new Vector3();
  private distanceNow = 150;
  private wantedDistance = 150;
  private pitchNow = 52;
  private wantedPitch = 52;
  private padding: ViewPadding = NO_PADDING;
  private width = 1;
  private height = 1;
  private readonly viewNow = { distance: 150, unitsPerPixel: 1 };
  /** How far the picture is shifted so its centre sits in the middle of the free area. */
  private readonly offset = new Vector2();
  private readonly wantedOffset = new Vector2();
  private framed = false;

  /**
   * @param instant Jump straight to each pose instead of gliding; used when the
   *   visitor prefers reduced motion.
   */
  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly instant = false,
  ) {}

  get distance(): number {
    return this.distanceNow;
  }

  /** How the map is seen right now; symbols on the map size themselves from it. */
  get view(): MapView {
    return this.viewNow;
  }

  setViewport(width: number, height: number, padding: ViewPadding = NO_PADDING): void {
    this.width = width;
    this.height = height;
    this.padding = padding;
    this.wantedOffset.set((padding.right - padding.left) / 2, (padding.bottom - padding.top) / 2);
    // The first framing is taken at once; later changes glide, so a panel opening never jolts the map.
    if (!this.framed || this.instant) this.offset.copy(this.wantedOffset);
    this.framed = true;
    this.shift();
    this.measure();
  }

  moveTo(pose: CameraPose, immediate = false): void {
    this.wantedTarget.copy(pose.target);
    this.wantedDistance = pose.distance;
    this.wantedPitch = pose.pitch;
    if (immediate) {
      this.target.copy(pose.target);
      this.distanceNow = pose.distance;
      this.pitchNow = pose.pitch;
      this.apply();
    }
  }

  /**
   * Distance from which a ground rectangle of the given half extents fits the free area.
   * `margin` is the room left around it, as a multiple of the tightest fit.
   */
  distanceToFit(
    halfWidth: number,
    halfDepth: number,
    pitch: number,
    margin = FRAME_MARGIN,
  ): number {
    const freeWidth = Math.max(1, this.width - this.padding.left - this.padding.right);
    const freeHeight = Math.max(1, this.height - this.padding.top - this.padding.bottom);
    const halfFov = Math.tan(MathUtils.degToRad(this.camera.fov / 2));
    const horizontal = halfWidth / (halfFov * this.camera.aspect * (freeWidth / this.width));
    const foreshortened = halfDepth * Math.sin(MathUtils.degToRad(pitch));
    const vertical = foreshortened / (halfFov * (freeHeight / this.height));
    return Math.max(horizontal, vertical) * margin;
  }

  update(deltaSeconds: number): void {
    const blend = this.instant ? 1 : 1 - Math.exp(-deltaSeconds * RESPONSE);
    this.target.lerp(this.wantedTarget, blend);
    this.distanceNow = MathUtils.lerp(this.distanceNow, this.wantedDistance, blend);
    this.pitchNow = MathUtils.lerp(this.pitchNow, this.wantedPitch, blend);
    if (!this.offset.equals(this.wantedOffset)) {
      this.offset.lerp(this.wantedOffset, blend);
      if (this.offset.distanceToSquared(this.wantedOffset) < 0.01)
        this.offset.copy(this.wantedOffset);
      this.shift();
    }
    this.apply();
  }

  private apply(): void {
    const pitch = MathUtils.degToRad(this.pitchNow);
    const ground = Math.cos(pitch) * this.distanceNow;
    this.camera.position.set(
      this.target.x + Math.sin(AZIMUTH) * ground,
      this.target.y + Math.sin(pitch) * this.distanceNow,
      this.target.z + Math.cos(AZIMUTH) * ground,
    );
    this.camera.lookAt(this.target);
    this.measure();
  }

  private shift(): void {
    this.camera.setViewOffset(
      this.width,
      this.height,
      this.offset.x,
      this.offset.y,
      this.width,
      this.height,
    );
  }

  private measure(): void {
    const halfFov = Math.tan(MathUtils.degToRad(this.camera.fov / 2));
    this.viewNow.distance = this.distanceNow;
    this.viewNow.unitsPerPixel = (2 * this.distanceNow * halfFov) / this.height;
  }
}
