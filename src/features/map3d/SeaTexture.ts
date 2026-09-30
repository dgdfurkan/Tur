import type { MapBounds, MapData, Ring } from './MapData';

const SEA = '#a8d3ea';
const SHALLOWS = '#c3e3f3';
const NEIGHBOUR = '#e6e8dc';
const NEIGHBOUR_EDGE = 'rgb(120 130 110 / 0.35)';
/** Share of each side over which neighbouring land dissolves into open sea. */
const FADE = 0.16;

/**
 * Paints everything around Turkey on one canvas: sea, a pale band of shallow
 * water along the coasts, and neighbouring land that fades out towards the
 * edges, so no view ever shows where the map data stops.
 */
export class SeaTexture {
  readonly canvas: HTMLCanvasElement;

  constructor(
    data: MapData,
    private readonly bounds: MapBounds,
    pixelWidth: number,
  ) {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    this.canvas = document.createElement('canvas');
    this.canvas.width = pixelWidth;
    this.canvas.height = Math.round((pixelWidth * height) / width);

    // Coasts are clipped where the map data ends, so everything drawn along
    // them goes on a layer that fades out before it reaches the frame.
    const coasts = this.layer();
    this.paintShallows(coasts.context, data);
    this.paintNeighbours(coasts.context, data);
    this.fadeEdges(coasts.context);

    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('2D canvas is unavailable');
    context.fillStyle = SEA;
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    context.drawImage(coasts.canvas, 0, 0);
  }

  private get scale(): number {
    return this.canvas.width / (this.bounds.maxX - this.bounds.minX);
  }

  private layer(): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = this.canvas.width;
    canvas.height = this.canvas.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2D canvas is unavailable');
    return { canvas, context };
  }

  private trace(context: CanvasRenderingContext2D, rings: readonly Ring[]): void {
    context.beginPath();
    for (const ring of rings) {
      ring.forEach(([x, y], index) => {
        // The canvas y axis points south.
        const px = (x - this.bounds.minX) * this.scale;
        const py = (this.bounds.maxY - y) * this.scale;
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      });
      context.closePath();
    }
  }

  private paintShallows(context: CanvasRenderingContext2D, data: MapData): void {
    const unit = this.canvas.width / 2048;
    context.lineJoin = 'round';
    this.trace(context, [...data.turkey, ...data.neighbours]);
    context.strokeStyle = `${SHALLOWS}99`;
    context.lineWidth = 34 * unit;
    context.stroke();
    context.strokeStyle = SHALLOWS;
    context.lineWidth = 14 * unit;
    context.stroke();
  }

  private paintNeighbours(context: CanvasRenderingContext2D, data: MapData): void {
    this.trace(context, data.neighbours);
    context.fillStyle = NEIGHBOUR;
    context.fill();
    context.strokeStyle = NEIGHBOUR_EDGE;
    context.lineWidth = (2 * this.canvas.width) / 2048;
    context.stroke();
  }

  /** Multiplies the layer's alpha by a ramp on each axis, leaving the middle untouched. */
  private fadeEdges(context: CanvasRenderingContext2D): void {
    const { width, height } = this.canvas;
    context.globalCompositeOperation = 'destination-in';
    for (const gradient of [
      context.createLinearGradient(0, 0, width, 0),
      context.createLinearGradient(0, 0, 0, height),
    ]) {
      gradient.addColorStop(0, 'rgb(0 0 0 / 0)');
      gradient.addColorStop(FADE, 'rgb(0 0 0 / 1)');
      gradient.addColorStop(1 - FADE, 'rgb(0 0 0 / 1)');
      gradient.addColorStop(1, 'rgb(0 0 0 / 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }
    context.globalCompositeOperation = 'source-over';
  }
}
