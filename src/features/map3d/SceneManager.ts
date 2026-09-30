import { Color, Fog, PerspectiveCamera, Scene, WebGLRenderer, type Texture } from 'three';
import type { MapSurface } from './MapSurface';
import { lowerQuality, type QualityProfile } from './QualityProfile';
import type { Disposable, Updatable } from '@/shared/lifecycle';

const SAMPLE_FRAMES = 90;
const SLOW_FRAME_MS = 22;
const MAX_DELTA_SECONDS = 0.1;

/**
 * Owns the renderer and the frame loop. The loop only runs while the canvas is
 * on screen and the tab is visible, and the pixel ratio drops automatically
 * when the first frames come in slow.
 */
export class SceneManager implements Disposable {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(32, 1, 1, 1600);
  private readonly renderer: WebGLRenderer;
  private readonly updatables = new Set<Updatable>();
  private readonly resizeObserver: ResizeObserver;
  private readonly visibilityObserver: IntersectionObserver;
  private readonly backdrop = new Color();
  private readonly fog = new Fog(this.backdrop, 1, 2);
  private frameHandle = 0;
  private lastTime = 0;
  private elapsed = 0;
  private onScreen = true;
  private running = false;
  private sampleCount = 0;
  private sampleTotal = 0;

  private readonly canvas: HTMLCanvasElement;

  constructor(
    surface: MapSurface,
    private profile: QualityProfile,
  ) {
    this.canvas = surface.canvas;
    this.scene.background = this.backdrop;
    this.scene.fog = this.fog;
    const { canvas } = this;
    // The context is already open: whoever chose the 3D map had to look at it first.
    this.renderer = new WebGLRenderer({ canvas, context: surface.context });
    this.applyPixelRatio();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.onScreen = entry?.isIntersecting ?? true;
      this.sync();
    });
    this.visibilityObserver.observe(canvas);
    document.addEventListener('visibilitychange', this.sync);
    this.resize();
  }

  get quality(): QualityProfile {
    return this.profile;
  }

  get size(): { width: number; height: number } {
    return { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
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

  start(): void {
    this.running = true;
    this.sync();
  }

  stop(): void {
    this.running = false;
    this.sync();
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.visibilityObserver.disconnect();
    document.removeEventListener('visibilitychange', this.sync);
    this.updatables.clear();
    this.renderer.dispose();
  }

  private readonly sync = (): void => {
    const shouldRun = this.running && this.onScreen && !document.hidden;
    if (shouldRun && this.frameHandle === 0) {
      this.lastTime = performance.now();
      this.frameHandle = requestAnimationFrame(this.frame);
    } else if (!shouldRun && this.frameHandle !== 0) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = 0;
    }
  };

  private readonly frame = (now: number): void => {
    this.frameHandle = requestAnimationFrame(this.frame);
    const frameMs = now - this.lastTime;
    this.lastTime = now;
    // A long gap (tab switch, breakpoint) must not fling the animation forward.
    const delta = Math.min(frameMs / 1000, MAX_DELTA_SECONDS);
    this.elapsed += delta;
    for (const updatable of this.updatables) updatable.update(delta, this.elapsed);
    this.renderer.render(this.scene, this.camera);
    this.sampleFrame(frameMs);
  };

  private sampleFrame(frameMs: number): void {
    if (this.sampleCount >= SAMPLE_FRAMES) return;
    // The first frames compile shaders and upload geometry; they say nothing about steady state.
    if (this.elapsed < 0.5) return;
    this.sampleCount += 1;
    this.sampleTotal += frameMs;
    if (this.sampleCount < SAMPLE_FRAMES) return;
    if (this.sampleTotal / SAMPLE_FRAMES > SLOW_FRAME_MS && this.profile.name !== 'low') {
      this.profile = lowerQuality(this.profile);
      this.applyPixelRatio();
      this.resize();
      this.sampleCount = 0;
      this.sampleTotal = 0;
    }
  }

  private applyPixelRatio(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.profile.pixelRatioCap));
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
