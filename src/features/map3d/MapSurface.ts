/** What the 3D map draws on: a canvas with its open graphics context, and a layer for place names. */
export interface MapSurface {
  readonly canvas: HTMLCanvasElement;
  readonly context: WebGL2RenderingContext;
  readonly labels: HTMLElement;
}
