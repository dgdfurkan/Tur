import { createRandom } from './random';

const SIZE = 512;
const TUFTS = 90;
const SPECKS = 170;
const INK = 'rgb(0 0 0 / 0.17)';

/**
 * A small tile of grass tufts and specks that repeats over the land. The land
 * painting covers the whole country, so up close it is soft; this tile stays
 * sharp there and gives the eye something to measure the coach's speed against.
 * It only darkens what is under it, so it is painted in greys on white.
 */
export class GroundDetail {
  readonly canvas: HTMLCanvasElement;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('2D canvas is unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, SIZE, SIZE);
    context.strokeStyle = INK;
    context.fillStyle = INK;
    context.lineCap = 'round';

    const random = createRandom(11);
    // Every mark is drawn nine times, shifted by one tile each way, so the edges meet seamlessly.
    const tiled = (draw: (x: number, y: number) => void): void => {
      const x = random() * SIZE;
      const y = random() * SIZE;
      for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) draw(x + dx, y + dy);
    };

    for (let i = 0; i < TUFTS; i += 1) {
      const height = 5 + random() * 6;
      const lean = (random() - 0.5) * 3;
      context.lineWidth = 1.4 + random() * 0.8;
      tiled((x, y) => {
        context.beginPath();
        for (const spread of [-0.55, 0, 0.55]) {
          context.moveTo(x, y);
          context.lineTo(x + spread * height + lean, y - height * (1 - Math.abs(spread) * 0.4));
        }
        context.stroke();
      });
    }

    for (let i = 0; i < SPECKS; i += 1) {
      const radius = 0.8 + random() * 1.6;
      tiled((x, y) => {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      });
    }
  }
}
