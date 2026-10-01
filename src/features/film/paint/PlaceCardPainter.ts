import { tr } from '@/i18n/tr';
import { formatMinutes } from '@/shared/format';
import type { FilmLayout } from '../FilmLayout';
import type { FilmOverlay } from '../FilmOverlay';
import type { SceneImages } from '../SceneImages';
import { COLOURS, type Brush, type TextStyle } from './Brush';
import { easeOut } from './easing';

const RADIUS = 16;
const PAD = 14;
const META: TextStyle = { size: 12.5, weight: 650 };
const META_QUIET: TextStyle = { size: 12.5, weight: 500 };
const FACT: TextStyle = { size: 12.5, weight: 650 };
const SUMMARY: TextStyle = { size: 12.5, weight: 450 };
const LINE = 17;
const MAX_FACTS = 2;
const ART_BACKDROP = '#e9eef2';

/** The card about the place the coach has reached: its picture, its name and a fact or two. */
export class PlaceCardPainter {
  /** Beside the picture the text column is narrow, so the name is set smaller and may take two lines. */
  private readonly beside: boolean;
  private readonly name: TextStyle;

  constructor(
    private readonly brush: Brush,
    private readonly layout: FilmLayout,
    private readonly scenes: SceneImages,
  ) {
    const { art, frame } = layout.card;
    this.beside = art.width < frame.width;
    this.name = { size: this.beside ? 18 : 21, weight: 750, width: 'semi-condensed' };
  }

  paint(place: NonNullable<FilmOverlay['place']>): void {
    const { brush, layout } = this;
    const { frame, art, text } = layout.card;
    const { stop } = place.stop;

    brush.with({ alpha: place.shown, dy: (1 - easeOut(place.shown)) * 30 }, () => {
      brush.card(frame, RADIUS);
      const corners = this.beside ? [RADIUS, 0, 0, RADIUS] : [RADIUS, RADIUS, 0, 0];
      const image = this.scenes.get(stop.scene);
      if (image) brush.cover(image, this.scenes.size, art, corners);
      else brush.fillRound(art, corners, ART_BACKDROP);

      const x = text.x + PAD;
      const width = text.width - PAD * 2;
      let y = text.y + 12;

      y += this.meta(stop.kind, stop.durationMinutes, x, y) + 3;
      const nameLines = brush.wrap(stop.name, this.name, width, this.beside ? 2 : 1);
      y += brush.block(nameLines, x, y, this.name, COLOURS.asphalt, 1.16) + 5;

      for (const fact of stop.facts.slice(0, MAX_FACTS)) {
        this.fact(fact.label, fact.value, x, y, width);
        y += LINE;
      }

      // Whatever room is left goes to the description.
      const room = Math.floor((text.y + text.height - 10 - y - 2) / LINE);
      if (room >= 1) {
        const lines = brush.wrap(stop.summary, SUMMARY, width, room);
        brush.block(lines, x, y + 2, SUMMARY, COLOURS.muted, LINE / SUMMARY.size);
      }
    });
  }

  /** The kind of stop and how long the coach stays; returns the height used. */
  private meta(
    kind: keyof typeof tr.route.kinds,
    minutes: number | undefined,
    x: number,
    y: number,
  ): number {
    const { brush } = this;
    const middle = y + LINE / 2;
    const label = tr.route.kinds[kind];
    brush.text(label, x, middle, META, COLOURS.brown);
    if (minutes !== undefined) {
      const clock = x + brush.measure(label, META) + 12;
      this.clock(clock + 5, middle);
      brush.text(formatMinutes(minutes), clock + 15, middle, META_QUIET, COLOURS.muted);
    }
    return LINE;
  }

  private fact(label: string, value: string, x: number, y: number, width: number): void {
    const { brush } = this;
    const middle = y + LINE / 2;
    brush.text(label, x, middle, META_QUIET, COLOURS.muted);
    const from = x + brush.measure(label, META_QUIET) + 8;
    const [fitted = ''] = brush.wrap(value, FACT, x + width - from, 1);
    brush.text(fitted, from, middle, FACT, COLOURS.asphalt);
  }

  private clock(x: number, y: number): void {
    const { ctx } = this.brush;
    ctx.save();
    ctx.strokeStyle = COLOURS.muted;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.moveTo(x, y - 2.6);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 2, y + 1.2);
    ctx.stroke();
    ctx.restore();
  }
}
