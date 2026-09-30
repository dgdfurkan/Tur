import { TURKEY_PROJECTION, type GeoCoordinates } from '@/domain/geo/MapProjection';
import { ringsExtent, type MapData, type Ring, type RingsExtent } from './MapData';
import { createRandom } from './random';

interface Wash extends GeoCoordinates {
  readonly radiusKm: number;
  readonly color: string;
}

const BASE = '#eee3c0';
const FOREST = '#8fbd6c';
const MEADOW = '#b9d08a';
const OLIVE = '#a8c47c';
const WHEAT = '#f0dc9c';
const TUFF = '#f0d2b4';
const HIGHLAND = '#d8c096';
const STEPPE = '#e6cf98';

/** Broad washes of colour, as on a painted tourist map: green coasts, a wheat-coloured interior. */
const WASHES: readonly Wash[] = [
  { lat: 39.0, lon: 33.4, radiusKm: 280, color: WHEAT },
  { lat: 39.4, lon: 41.0, radiusKm: 320, color: HIGHLAND },
  { lat: 38.6, lon: 43.4, radiusKm: 200, color: HIGHLAND },
  { lat: 37.5, lon: 39.6, radiusKm: 250, color: STEPPE },
  { lat: 38.4, lon: 34.7, radiusKm: 120, color: TUFF },
  { lat: 41.5, lon: 27.4, radiusKm: 150, color: MEADOW },
  { lat: 40.2, lon: 29.4, radiusKm: 150, color: MEADOW },
  { lat: 38.6, lon: 27.9, radiusKm: 190, color: OLIVE },
  { lat: 37.2, lon: 28.4, radiusKm: 150, color: OLIVE },
  ...[29.6, 31.2, 32.8, 34.4, 36.0].map((lon) => ({ lat: 36.75, lon, radiusKm: 95, color: OLIVE })),
  ...[30.6, 32.0, 33.4, 34.8, 36.2, 37.6, 39.0, 40.4, 41.6].map((lon) => ({
    lat: 41.15,
    lon,
    radiusKm: 105,
    color: FOREST,
  })),
];

/** Course of the Kızılırmak, the river the Cappadocia route meets at Avanos. */
const KIZILIRMAK: readonly GeoCoordinates[] = [
  { lat: 39.85, lon: 38.4 },
  { lat: 39.72, lon: 37.0 },
  { lat: 39.2, lon: 35.9 },
  { lat: 38.75, lon: 35.0 },
  { lat: 38.78, lon: 34.4 },
  { lat: 39.25, lon: 33.6 },
  { lat: 40.05, lon: 33.55 },
  { lat: 40.75, lon: 34.1 },
  { lat: 41.05, lon: 34.95 },
  { lat: 41.45, lon: 35.6 },
  { lat: 41.73, lon: 35.95 },
];

/**
 * Paints the top face of the country slab on a 2D canvas: regional colour
 * washes, a shaded coastline, lakes and one river. Painting once into a texture
 * gives the map its illustrated look at no per-frame cost.
 */
export class LandTexture {
  readonly extent: RingsExtent;
  readonly canvas: HTMLCanvasElement;

  constructor(data: MapData, pixelWidth: number) {
    this.extent = ringsExtent(data.turkey);
    this.canvas = document.createElement('canvas');
    this.canvas.width = pixelWidth;
    this.canvas.height = Math.round((pixelWidth * this.extent.height) / this.extent.width);
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('2D canvas is unavailable');
    this.paint(context, data);
  }

  private get scale(): number {
    return this.canvas.width / this.extent.width;
  }

  /** Plane kilometres to canvas pixels; the canvas y axis points south. */
  private toPixel(x: number, y: number): [number, number] {
    return [
      (x - this.extent.minX) * this.scale,
      (this.extent.minY + this.extent.height - y) * this.scale,
    ];
  }

  private geoToPixel(point: GeoCoordinates): [number, number] {
    const plane = TURKEY_PROJECTION.project(point);
    return this.toPixel(plane.x, plane.y);
  }

  /**
   * Draws a soft closed or open curve through points that are only a rough
   * outline (hand-placed lakes, the river), rounding every corner.
   */
  private traceSmooth(
    context: CanvasRenderingContext2D,
    points: readonly (readonly [number, number])[],
    closed: boolean,
  ): void {
    const midpoint = (a: readonly [number, number], b: readonly [number, number]) =>
      [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
    const first = points[0];
    const last = points.at(-1);
    if (!first || !last) return;
    context.beginPath();
    const start = closed ? midpoint(last, first) : first;
    context.moveTo(start[0], start[1]);
    points.forEach((point, index) => {
      const next = points[index + 1] ?? (closed ? first : undefined);
      if (!next) {
        context.lineTo(point[0], point[1]);
        return;
      }
      const to = midpoint(point, next);
      context.quadraticCurveTo(point[0], point[1], to[0], to[1]);
    });
    if (closed) context.closePath();
  }

  private trace(context: CanvasRenderingContext2D, rings: readonly Ring[]): void {
    context.beginPath();
    for (const ring of rings) {
      ring.forEach(([x, y], index) => {
        const [px, py] = this.toPixel(x, y);
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      });
      context.closePath();
    }
  }

  private paint(context: CanvasRenderingContext2D, data: MapData): void {
    const { width, height } = this.canvas;
    const unit = width / 2048;

    context.save();
    this.trace(context, data.turkey);
    context.clip();

    context.fillStyle = BASE;
    context.fillRect(0, 0, width, height);

    for (const wash of WASHES) {
      const [cx, cy] = this.geoToPixel(wash);
      const radius = wash.radiusKm * this.scale;
      const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, wash.color);
      gradient.addColorStop(0.55, wash.color);
      gradient.addColorStop(1, `${wash.color}00`);
      context.fillStyle = gradient;
      context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }

    // Paper grain keeps large flat areas from looking synthetic.
    const random = createRandom(7);
    for (let i = 0; i < 5000; i += 1) {
      context.fillStyle = random() > 0.5 ? 'rgb(255 255 255 / 0.10)' : 'rgb(90 70 40 / 0.06)';
      context.fillRect(random() * width, random() * height, 2 * unit, 2 * unit);
    }

    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.strokeStyle = '#8ec3e2';
    context.lineWidth = 3.5 * unit;
    this.traceSmooth(
      context,
      KIZILIRMAK.map((point) => this.geoToPixel(point)),
      false,
    );
    context.stroke();

    // Shading along the coast and borders, drawn inside the clip so it only tints land.
    this.trace(context, data.turkey);
    context.strokeStyle = 'rgb(70 95 60 / 0.16)';
    context.lineWidth = 26 * unit;
    context.stroke();
    context.strokeStyle = 'rgb(70 95 60 / 0.22)';
    context.lineWidth = 9 * unit;
    context.stroke();
    context.restore();

    // Tuz Gölü is a salt flat, so it is painted pale rather than blue.
    const salt = { fill: '#f8ece6', shore: 'rgb(190 165 150 / 0.55)' };
    const water = { fill: '#9fcde8', shore: 'rgb(60 100 130 / 0.35)' };
    for (const [name, ring] of Object.entries(data.lakes)) {
      const paint = name === 'tuz' ? salt : water;
      this.traceSmooth(
        context,
        ring.map(([x, y]) => this.toPixel(x, y)),
        true,
      );
      context.fillStyle = paint.fill;
      context.fill();
      context.strokeStyle = paint.shore;
      context.lineWidth = 2 * unit;
      context.stroke();
    }
  }
}
