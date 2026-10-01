import { tr } from '@/i18n/tr';
import type { FilmCopy } from '../FilmCopy';
import type { FilmLayout } from '../FilmLayout';
import { COLOURS, type Brush, type TextStyle } from './Brush';
import { easeOut } from './easing';
import type { Logo } from './Logo';

const HEIGHT = 40;
const LOGO = 28;
const PAD = 6;
const NAME: TextStyle = { size: 15, weight: 700, width: 'semi-condensed' };
const DAY: TextStyle = { size: 13, weight: 650, width: 'semi-condensed' };
const BADGE_HEIGHT = 28;

/** The plate with the logo and the agency's name, and the badge that says which day it is. */
export class BrandPainter {
  constructor(
    private readonly brush: Brush,
    private readonly layout: FilmLayout,
    private readonly copy: FilmCopy,
    private readonly logo: Logo,
  ) {}

  paint(amount: number, day: number | null): void {
    const { brush, layout, copy } = this;
    const eased = easeOut(amount);
    brush.with({ alpha: amount, dy: -(1 - eased) * 10 }, () => {
      const { x, y } = layout.brand;
      const hasName = copy.brandName !== '';
      const nameWidth = hasName ? brush.measure(copy.brandName, NAME) : 0;
      const width = PAD + LOGO + (hasName ? 8 + nameWidth + 12 : PAD);

      const { ctx } = brush;
      ctx.save();
      ctx.shadowColor = 'rgb(27 31 36 / 0.2)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      brush.fillRound({ x, y, width, height: HEIGHT }, 10, COLOURS.white);
      ctx.restore();
      this.logo.paint(brush, { x: x + PAD, y: y + PAD, width: LOGO, height: LOGO });
      if (hasName) {
        brush.text(copy.brandName, x + PAD + LOGO + 8, y + HEIGHT / 2, NAME, COLOURS.asphalt);
      }

      if (day === null) return;
      const label = `${day}. ${tr.tour.day}`;
      const badgeWidth = brush.measure(label, DAY) + 20;
      const badge = {
        x: layout.badge.right - badgeWidth,
        y: layout.badge.y + (HEIGHT - BADGE_HEIGHT) / 2,
        width: badgeWidth,
        height: BADGE_HEIGHT,
      };
      brush.fillRound(badge, 7, COLOURS.asphalt);
      brush.text(
        label,
        badge.x + badgeWidth / 2,
        badge.y + BADGE_HEIGHT / 2,
        DAY,
        COLOURS.white,
        'center',
      );
    });
  }
}
