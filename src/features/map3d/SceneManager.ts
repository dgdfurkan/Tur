import { Color, Fog, PerspectiveCamera, Scene, WebGLRenderer, type Texture } from 'three';
import type { FixedFrame, MapSurface } from './MapSurface';
import { lowerQuality, type QualityProfile } from './QualityProfile';
import type { Disposable, Updatable } from '@/shared/lifecycle';

/**
 * Owns the renderer, the scene and the camera, and draws one frame at a time.
 * On a page a frame loop calls it; for film frames the caller steps it itself.
 */
export class SceneManager implements Disposable {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(32, 1, 1, 1600);
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly updatables = new Set<Updatable>();
  private readonly resizeObserver: ResizeObserver | undefined;
  private readonly frame: FixedFrame | undefined;
  private readonly backdrop = new Color();
  private readonly fog = new Fog(this.backdrop, 1, 2);
  private elapsed = 0;

  constructor(
    surface: MapSurface,
    private profile: QualityProfile,
  ) {
    this.canvas = surface.canvas;
    this.frame = surface.frame;
    this.scene.background = this.backdrop;
    this.scene.fog = this.fog;
    // The context is already open: whoever chose the 3D map had to look at it first.
    this.renderer = new WebGLRenderer({ canvas: this.canvas, context: surface.context });
    this.applyPixelRatio();

    if (!this.frame) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas);
    }
    this.resize();
  }

  get quality(): QualityProfile {
    return this.profile;
  }

  /** Size in layout pixels. */
  get size(): { width: number; height: number } {
    return this.frame ?? { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
  }

  /** Seconds of animation drawn so far. */
  get time(): number {
    return this.elapsed;
  }

  /** The sky behind the map; distant land fades into the same colour. */
  setBackdrop(color: Color): void {
    this.backdrop.copy(color);
    this.fog.color.copy(color);
  }

  /** Haze begins behind the subject and thickens towards the horizon. */
  setHaze(near: number, far: number): void {
    this.fog.near = near;
    this.fog.far = far;
  }

  /** Sends a texture to the GPU now rather than in the middle of the first frame. */
  upload(texture: Texture): void {
    this.renderer.initTexture(texture);
  }

  /** Compiles every shader the scene needs without blocking, so the first frame is cheap. */
  async compile(): Promise<void> {
    await this.renderer.compileAsync(this.scene, this.camera);
  }

  add(updatable: Updatable): void {
    this.updatables.add(updatable);
  }

  /** Moves everything on by `deltaSeconds` and draws the result. */
  step(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    for (const updatable of this.updatables) updatable.update(deltaSeconds, this.elapsed);
    this.renderer.render(this.scene, this.camera);
  }

  /** Drops to the next cheaper profile; returns false when there is none. */
  lowerQuality(): boolean {
    if (this.profile.name === 'low' || this.frame) return false;
    this.profile = lowerQuality(this.profile);
    this.applyPixelRatio();
    this.resize();
    return true;
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.updatables.clear();
    this.renderer.dispose();
  }

  private applyPixelRatio(): void {
    this.renderer.setPixelRatio(
      this.frame?.pixelRatio ?? Math.min(window.devicePixelRatio, this.profile.pixelRatioCap),
    );
  }

  private resize(): void {
    const { width, height } = this.size;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
