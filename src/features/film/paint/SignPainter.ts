import { tr } from '@/i18n/tr';
import type { FilmCopy } from '../FilmCopy';
import type { FilmLayout } from '../FilmLayout';
import { COLOURS, type Brush, type TextStyle } from './Brush';
import { after, easeOut } from './easing';
import type { Logo } from './Logo';

const PAD = 18;
const GAP = 8;
const TITLE: TextStyle = { size: 29, weight: 800, width: 'condensed' };
const TITLE_LINE = 1.08;
const SUBTITLE: TextStyle = { size: 15, weight: 600, width: 'semi-condensed' };
const CHIP: TextStyle = { size: 13, weight: 650, width: 'semi-condensed' };
const CHIP_HEIGHT = 30;
const DETAIL: TextStyle = { size: 13.5, weight: 650, width: 'semi-condensed' };
const BRAND: TextStyle = { size: 17, weight: 700, width: 'semi-condensed' };
const CONTACT_LABEL: TextStyle = { size: 12.5, weight: 600, width: 'semi-condensed' };
const CONTACT: TextStyle = { size: 21, weight: 750, width: 'semi-condensed' };
const LOGO = 34;
const CONTACT_HEIGHT = 66;

/**
 * The signs that open and close a film, made to look like road signs: a blue
 * one for the tour's name, brown ones for what there is to see.
 */
export class SignPainter {
  constructor(
    private readonly brush: Brush,
    private readonly layout: FilmLayout,
    private readonly copy: FilmCopy,
    private readonly logo: Logo,
  ) {}

  /** The opening sign; `amount` rises as it arrives and falls as it leaves. */
  title(amount: number): void {
    const { brush, layout, copy } = this;
    const { x, y, width } = layout.sign;
    const lines = brush.wrap(copy.title, TITLE, width - PAD * 2, 3);
    const titleHeight = lines.length * TITLE.size * TITLE_LINE;
    const height = PAD + titleHeight + 6 + SUBTITLE.size * 1.3 + PAD - 2;

    brush.with({ alpha: amount, dy: -(1 - easeOut(amount)) * 28 }, () => {
      brush.plate({ x, y, width, height }, COLOURS.blue, 14);
      const used = brush.block(lines, x + PAD, y + PAD - 2, TITLE, COLOURS.white, TITLE_LINE);
      brush.text(
        copy.subtitle,
        x + PAD,
        y + PAD + used + 6 + SUBTITLE.size * 0.6,
        SUBTITLE,
        '#e2eef6',
      );
    });

    const next = this.chips(
      copy.chips,
      COLOURS.brown,
      COLOURS.white,
      y + height + GAP,
      amount,
      0.25,
    );
    this.chips(copy.details, COLOURS.white, COLOURS.asphalt, next, amount, 0.45);
  }

  /**
   * The closing signs: the tour again, who runs it and how to reach them. They
   * stand in the middle of the frame, over a map dimmed to let them be read.
   */
  outro(amount: number): void {
    const { brush, layout, copy } = this;
    const { x, width } = layout.sign;
    const lines = brush.wrap(copy.title, TITLE, width - PAD * 2, 2);
    const titleHeight = lines.length * TITLE.size * TITLE_LINE;
    const detailsHeight = copy.details.length === 0 ? 0 : 8 + copy.details.length * 20;
    const height =
      PAD + LOGO + 12 + titleHeight + 6 + SUBTITLE.size * 1.3 + detailsHeight + PAD - 2;
    const contactHeight = copy.contactLine === '' ? 0 : CONTACT_HEIGHT + GAP;
    const y = (layout.safe.top + layout.safe.bottom - height - contactHeight) / 2;

    brush.ctx.save();
    brush.ctx.globalAlpha *= 0.3 * amount;
    brush.ctx.fillStyle = COLOURS.asphalt;
    brush.ctx.fillRect(0, 0, layout.format.width, layout.format.height);
    brush.ctx.restore();

    brush.with({ alpha: amount, dy: -(1 - easeOut(amount)) * 28 }, () => {
      brush.plate({ x, y, width, height }, COLOURS.blue, 14);
      let top = y + PAD;
      // The logo stands on a white tile, so a dark logo is still readable on the blue sign.
      brush.fillRound({ x: x + PAD, y: top, width: LOGO, height: LOGO }, 8, COLOURS.white);
      this.logo.paint(brush, { x: x + PAD + 3, y: top + 3, width: LOGO - 6, height: LOGO - 6 });
      const [name = ''] = brush.wrap(copy.brandName, BRAND, width - PAD * 2 - LOGO - 10, 1);
      brush.text(name, x + PAD + LOGO + 10, top + LOGO / 2, BRAND, COLOURS.white);
      top += LOGO + 12;

      top += brush.block(lines, x + PAD, top, TITLE, COLOURS.white, TITLE_LINE) + 6;
      brush.text(copy.subtitle, x + PAD, top + SUBTITLE.size * 0.6, SUBTITLE, '#e2eef6');
      top += SUBTITLE.size * 1.3 + 8;
      for (const detail of copy.details) {
        brush.text(detail, x + PAD, top + 10, DETAIL, COLOURS.white);
        top += 20;
      }
    });

    if (copy.contactLine === '') return;
    // A brown sign under the blue one tells people how to book.
    const contactY = y + height + GAP;
    const shown = after(amount, 0.35, 0.65);
    brush.with({ alpha: shown, dy: -(1 - easeOut(shown)) * 18 }, () => {
      brush.plate({ x, y: contactY, width, height: CONTACT_HEIGHT }, COLOURS.brown, 14);
      brush.text(tr.studio.film.contact, x + PAD, contactY + 21, CONTACT_LABEL, '#f1e4da');
      const [line = ''] = brush.wrap(copy.contactLine, CONTACT, width - PAD * 2, 1);
      brush.text(line, x + PAD, contactY + 43, CONTACT, COLOURS.white);
    });
  }

  /**
   * A row of small signs that wraps within the sign's width. Each arrives a
   * little after the one before it. Returns the top edge for whatever follows.
   */
  private chips(
    labels: readonly string[],
    plate: string,
    ink: string,
    top: number,
    amount: number,
    delay: number,
  ): number {
    const { brush, layout } = this;
    if (labels.length === 0) return top;
    let x = layout.sign.x;
    let y = top;
    labels.forEach((label, index) => {
      const width = brush.measure(label, CHIP) + 22;
      if (x + width > layout.sign.x + layout.sign.width && x > layout.sign.x) {
        x = layout.sign.x;
        y += CHIP_HEIGHT + 6;
      }
      const shown = after(amount, delay + index * 0.1, 0.5);
      const at = { x, y, width, height: CHIP_HEIGHT };
      brush.with({ alpha: shown, dy: -(1 - easeOut(shown)) * 12 }, () => {
        if (plate === COLOURS.white) {
          brush.ctx.save();
          brush.ctx.shadowColor = 'rgb(27 31 36 / 0.2)';
          brush.ctx.shadowBlur = 10;
          brush.ctx.shadowOffsetY = 3;
          brush.fillRound(at, 8, plate);
          brush.ctx.restore();
        } else {
          brush.plate(at, plate, 8, 2.5);
        }
        brush.text(label, x + width / 2, y + CHIP_HEIGHT / 2, CHIP, ink, 'center');
      });
      x += width + 6;
    });
    return y + CHIP_HEIGHT + GAP;
  }
}
