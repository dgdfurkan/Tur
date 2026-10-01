import type { SceneManager } from './SceneManager';
import type { Disposable } from '@/shared/lifecycle';

const SAMPLE_FRAMES = 90;
const SLOW_FRAME_MS = 22;
const MAX_DELTA_SECONDS = 0.1;
/** The first frames upload geometry; they say nothing about steady state. */
const WARM_UP_SECONDS = 0.5;

/**
 * Drives a scene from the display's refresh. It only runs while the canvas is
 * on screen and the tab is visible, and lowers the quality when the first
 * frames come in slow.
 */
export class FrameLoop implements Disposable {
  private readonly visibilityObserver: IntersectionObserver;
  private frameHandle = 0;
  private lastTime = 0;
  private onScreen = true;
  private running = false;
  private sampleCount = 0;
  private sampleTotal = 0;

  constructor(private readonly scene: SceneManager) {
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.onScreen = entry?.isIntersecting ?? true;
      this.sync();
    });
    this.visibilityObserver.observe(scene.canvas);
    document.addEventListener('visibilitychange', this.sync);
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
    this.visibilityObserver.disconnect();
    document.removeEventListener('visibilitychange', this.sync);
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
    this.scene.step(Math.min(frameMs / 1000, MAX_DELTA_SECONDS));
    this.sample(frameMs);
  };

  private sample(frameMs: number): void {
    if (this.sampleCount >= SAMPLE_FRAMES || this.scene.time < WARM_UP_SECONDS) return;
    this.sampleCount += 1;
    this.sampleTotal += frameMs;
    if (this.sampleCount < SAMPLE_FRAMES) return;
    if (this.sampleTotal / SAMPLE_FRAMES > SLOW_FRAME_MS && this.scene.lowerQuality()) {
      this.sampleCount = 0;
      this.sampleTotal = 0;
    }
  }
}
