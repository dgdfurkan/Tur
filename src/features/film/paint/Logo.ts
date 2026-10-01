import type { Rect } from '../FilmLayout';
import { COLOURS, type Brush } from './Brush';

/** The mark shown beside the agency's name. */
export interface Logo {
  paint(brush: Brush, rect: Rect): void;
}

/** The site's own mark: a road between two places on a blue plate. It is drawn on a 40 by 40 grid. */
export class BrandMarkLogo implements Logo {
  private readonly road = new Path2D('M11 29c0-7 6-6 9-9s2-8 9-9');

  paint(brush: Brush, rect: Rect): void {
    const { ctx } = brush;
    ctx.save();
    ctx.translate(rect.x, rect.y);
    ctx.scale(rect.width / 40, rect.height / 40);
    brush.fillRound({ x: 0, y: 0, width: 40, height: 40 }, 9, COLOURS.blue);
    ctx.strokeStyle = COLOURS.white;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(3, 3, 34, 34, 6.5);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.stroke(this.road);
    ctx.fillStyle = COLOURS.white;
    for (const [x, y] of [
      [11, 29],
      [29, 11],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** A logo the maker of the film uploaded. It is shown whole, never cropped or stretched. */
export class ImageLogo implements Logo {
  constructor(private readonly image: ImageBitmap) {}

  paint(brush: Brush, rect: Rect): void {
    const scale = Math.min(rect.width / this.image.width, rect.height / this.image.height);
    const width = this.image.width * scale;
    const height = this.image.height * scale;
    brush.ctx.drawImage(
      this.image,
      rect.x + (rect.width - width) / 2,
      rect.y + (rect.height - height) / 2,
      width,
      height,
    );
  }
}
