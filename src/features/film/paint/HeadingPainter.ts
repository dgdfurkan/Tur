import { roadKm } from '@/domain/tour/Tour';
import { formatKm } from '@/shared/format';
import type { FilmLayout } from '../FilmLayout';
import type { FilmOverlay } from '../FilmOverlay';
import { COLOURS, type Brush, type TextStyle } from './Brush';
import { easeOut } from './easing';

const HEIGHT = 52;
const PAD = 18;
const ARROW = 16;
const NAME: TextStyle = { size: 19, weight: 700, width: 'semi-condensed' };
const DISTANCE: TextStyle = { size: 15, weight: 600, width: 'semi-condensed' };

/** The blue direction sign that names the next stop while the coach is on the road. */
export class HeadingPainter {
  constructor(
    private readonly brush: Brush,
    private readonly layout: FilmLayout,
  ) {}

  paint(heading: NonNullable<FilmOverlay['heading']>): void {
    const { brush, layout } = this;
    const distance = formatKm(roadKm(heading.km));
    const distanceWidth = brush.measure(distance, DISTANCE);
    const fixed = PAD * 2 + ARROW + 12 + 16 + distanceWidth;
    const [name = ''] = brush.wrap(
      heading.stop.stop.name,
      NAME,
      layout.heading.maxWidth - fixed,
      1,
    );
    const width = fixed + brush.measure(name, NAME);
    const x = layout.heading.centre - width / 2;
    const y = layout.heading.bottom - HEIGHT;
    const middle = y + HEIGHT / 2;

    brush.with({ alpha: heading.shown, dy: (1 - easeOut(heading.shown)) * 16 }, () => {
      brush.plate({ x, y, width, height: HEIGHT }, COLOURS.blue);
      this.arrow(x + PAD, middle);
      brush.text(name, x + PAD + ARROW + 12, middle, NAME, COLOURS.white);
      brush.text(distance, x + width - PAD, middle, DISTANCE, COLOURS.white, 'right');
    });
  }

  /** The straight-ahead arrow of a direction sign, centred on `middle`. */
  private arrow(x: number, middle: number): void {
    const { ctx } = this.brush;
    const centre = x + ARROW / 2;
    ctx.save();
    ctx.strokeStyle = COLOURS.white;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(centre, middle + 9);
    ctx.lineTo(centre, middle - 8);
    ctx.moveTo(centre - 6.5, middle - 2);
    ctx.lineTo(centre, middle - 9);
    ctx.lineTo(centre + 6.5, middle - 2);
    ctx.stroke();
    ctx.restore();
  }
}
