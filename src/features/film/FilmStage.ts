import type { FixedFrame } from '@/features/map3d/MapSurface';
import { STUDIO_QUALITY } from '@/features/map3d/QualityProfile';
import { ThreeRouteView } from '@/features/map3d/ThreeRouteView';
import type { Disposable } from '@/shared/lifecycle';
import { openGraphics } from '@/shared/webgl';
import { CanvasLabels } from './CanvasLabels';
import type { FilmFormat } from './formats';
import { Brush } from './paint/Brush';

/** How long the map is given to come to rest before a single moment is shown as a still. */
const SETTLE_STEPS = 45;
const SETTLE_STEP_SECONDS = 0.06;

function frameOf(format: FilmFormat, pixelRatio: number): FixedFrame {
  return { width: format.width, height: format.height, pixelRatio };
}

/**
 * Where a film frame is put together: the 3D map is drawn on a canvas of its
 * own, copied onto the frame, and the place-name signs and everything else are
 * painted over it. Nothing here runs by itself; every frame is asked for.
 */
export class FilmStage implements Disposable {
  private constructor(
    readonly view: ThreeRouteView,
    readonly brush: Brush,
    private readonly labels: CanvasLabels,
    private readonly output: HTMLCanvasElement,
    private format: FilmFormat,
    private pixelRatio: number,
  ) {}

  /**
   * Builds the stage, or returns null where the 3D map cannot be drawn.
   * @param output The canvas the finished frames appear on.
   * @param fontFamily The page's typeface, as a CSS font-family value.
   * @param allowSoftware Accept a map drawn on the processor; slow, so only for tests.
   */
  static async create(
    output: HTMLCanvasElement,
    fontFamily: string,
    format: FilmFormat,
    pixelRatio: number,
    allowSoftware: boolean,
  ): Promise<FilmStage | null> {
    const canvas = document.createElement('canvas');
    const context = openGraphics(canvas, { antialias: true, allowSoftware });
    const pen = output.getContext('2d', { alpha: false });
    if (!context || !pen) return null;

    const brush = new Brush(pen, fontFamily);
    const labels = new CanvasLabels(brush);
    const view = await ThreeRouteView.create(
      { canvas, context, labels, frame: frameOf(format, pixelRatio) },
      STUDIO_QUALITY,
    );
    const stage = new FilmStage(view, brush, labels, output, format, pixelRatio);
    stage.sizeOutput();
    return stage;
  }

  /** Changes the shape or the sharpness of the frame. */
  resize(format: FilmFormat, pixelRatio: number): void {
    this.format = format;
    this.pixelRatio = pixelRatio;
    this.view.reframe(frameOf(format, pixelRatio));
    this.sizeOutput();
  }

  /** Draws one frame: the map moved on by `deltaSeconds`, its signs, then whatever `paint` adds. */
  draw(deltaSeconds: number, paint: () => void): void {
    this.view.step(deltaSeconds);
    this.labels.advance(deltaSeconds);
    this.compose(paint);
  }

  /**
   * Draws one moment as a still: the camera and everything else are first
   * given time to come to rest where the moment puts them.
   */
  drawStill(paint: () => void): void {
    for (let step = 0; step < SETTLE_STEPS; step += 1) this.view.step(SETTLE_STEP_SECONDS);
    this.labels.settle();
    this.compose(paint);
  }

  dispose(): void {
    this.view.dispose();
  }

  private compose(paint: () => void): void {
    const { ctx } = this.brush;
    const { width, height } = this.format;
    // Painting is done in layout pixels; this maps them onto the file's pixels.
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    // The map must be copied in the same task it was drawn in, before the browser clears it.
    ctx.drawImage(this.view.canvas, 0, 0, width, height);
    this.labels.paint();
    paint();
  }

  private sizeOutput(): void {
    this.output.width = Math.round(this.format.width * this.pixelRatio);
    this.output.height = Math.round(this.format.height * this.pixelRatio);
    // Resizing a canvas resets its context.
    this.brush.ctx.textBaseline = 'middle';
  }
}
