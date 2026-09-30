import type { LabelSurface } from './LabelSurface';

/** A frame of fixed size, for drawing that is not tied to an element laid out on a page. */
export interface FixedFrame {
  /** Size in layout pixels; signs and symbols are sized in these. */
  readonly width: number;
  readonly height: number;
  /** Device pixels per layout pixel. */
  readonly pixelRatio: number;
}

/** What the 3D map draws on: a canvas with its open graphics context, and something to show place names. */
export interface MapSurface {
  readonly canvas: HTMLCanvasElement;
  readonly context: WebGL2RenderingContext;
  readonly labels: LabelSurface;
  /**
   * Given for film frames: the map then has this size whatever the canvas
   * element measures, and draws only when it is told to.
   */
  readonly frame?: FixedFrame;
}
