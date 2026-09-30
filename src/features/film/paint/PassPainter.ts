import { tr } from '@/i18n/tr';
import type { FilmCopy } from '../FilmCopy';
import type { FilmFormat } from '../formats';
import { PASS_TIMING } from '../FilmOverlay';
import { COLOURS, type Brush, type TextStyle } from './Brush';
import { clamp01, easeIn, easeOut } from './easing';
import type { Logo } from './Logo';

const WIDTH = 320;
const HEIGHT = 226;
const STUB = 88;
const PAD = 16;
const RADIUS = 16;
const FADE = 0.25;
const LEAVE = 0.4;

const BRAND: TextStyle = { size: 14, weight: 750, width: 'semi-condensed' };
const KIND: TextStyle = { size: 11.5, weight: 500 };
const TITLE: TextStyle = { size: 19, weight: 750, width: 'semi-condensed' };
const LABEL: TextStyle = { size: 11, weight: 500 };
const VALUE: TextStyle = { size: 13, weight: 650 };
const SEAT: TextStyle = { size: 38, weight: 800, width: 'condensed' };
const DESTINATION: TextStyle = { size: 12.5, weight: 650, width: 'semi-condensed' };
const STAMP: TextStyle = { size: 16, weight: 800, width: 'condensed' };

/** Widths of the bars and gaps of the barcode, which only has to look like one. */
const BARS = [
  2, 3, 1, 2, 3, 2, 1, 1, 2, 3, 1, 2, 2, 1, 3, 2, 1, 2, 3, 1, 1, 2, 3, 2, 1, 3, 2, 1, 2, 2,
];

/**
 * The boarding pass that opens the whole-journey film: it slides in, is
 * stamped and punched, then its stub is torn off, as on the route page.
 */
export class PassPainter {
  constructor(
    private readonly brush: Brush,
    private readonly format: FilmFormat,
    private readonly copy: FilmCopy,
    private readonly logo: Logo,
    /** How long the scene lasts, so the pass can leave in time. */
    private readonly seconds: number,
  ) {}

  /** @param time Seconds since the scene began. */
  paint(time: number): void {
    const { brush, format } = this;
    const { ctx } = brush;
    const arrive = easeOut(time / PASS_TIMING.arrived);
    const leaving = clamp01((time - PASS_TIMING.leaveAt) / LEAVE);
    const backdrop = Math.min(clamp01(time / FADE), clamp01((this.seconds - time) / FADE));

    ctx.save();
    ctx.globalAlpha *= 0.55 * backdrop;
    ctx.fillStyle = COLOURS.asphalt;
    ctx.fillRect(0, 0, format.width, format.height);
    ctx.restore();

    const width = Math.min(WIDTH, format.width - 28);
    const x = (format.width - width) / 2;
    const y = format.height * 0.47 - HEIGHT / 2;
    const centre = { x: format.width / 2, y: y + HEIGHT / 2 };
    // The pass gives a little under the stamp, then springs back.
    const sinceStamp = time - PASS_TIMING.stampAt;
    const squash =
      sinceStamp < 0 ? 1 : 1 - 0.022 * Math.exp(-sinceStamp * 9) * Math.cos(sinceStamp * 28);

    brush.with(
      {
        alpha: clamp01(time / FADE),
        dy: (1 - arrive) * 56,
        rotate: -5 + 3.5 * arrive,
        scale: (0.94 + 0.06 * arrive) * squash,
        origin: centre,
      },
      () => {
        const mainWidth = width - STUB;
        const tear = easeIn(leaving);
        brush.with(
          { alpha: 1 - leaving, dx: tear * 30, dy: tear * 12, rotate: tear * 8, origin: centre },
          () => this.stub(x + mainWidth, y, time),
        );
        const lift = easeIn(clamp01((time - PASS_TIMING.leaveAt - 0.08) / LEAVE));
        brush.with({ alpha: 1 - lift, dy: -lift * 28 }, () => this.main(x, y, mainWidth, time));
      },
    );
  }

  private main(x: number, y: number, width: number, time: number): void {
    const { brush, copy } = this;
    const { ctx } = brush;
    ctx.save();
    ctx.shadowColor = 'rgb(0 0 0 / 0.35)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    brush.fillRound({ x, y, width, height: HEIGHT }, [RADIUS, 0, 0, RADIUS], COLOURS.white);
    ctx.restore();

    const left = x + PAD;
    const right = x + width - PAD;
    let top = y + PAD;
    this.logo.paint(brush, { x: left, y: top, width: 22, height: 22 });
    const [brand = ''] = brush.wrap(copy.brandName, BRAND, width - PAD * 2 - 30 - 62, 1);
    brush.text(brand, left + 30, top + 11, BRAND, COLOURS.asphalt);
    brush.text(tr.route.boardingPass, right, top + 11, KIND, COLOURS.muted, 'right');
    top += 22 + 12;

    const title = brush.wrap(copy.pass.tourTitle, TITLE, width - PAD * 2, 2);
    top += brush.block(title, left, top, TITLE, COLOURS.asphalt, 1.12) + 10;

    if (copy.pass.date !== '') {
      this.field(tr.route.date, copy.pass.date, left, top);
      this.field(tr.route.time, copy.pass.time, right, top, 'right');
      top += 36;
    }
    this.field(tr.tour.departurePoint, copy.pass.meetingPoint, left, top);

    this.barcode(left, y + HEIGHT - PAD - 26, (width - PAD * 2) * 0.46, 26);
    this.stamp(right - 58, y + HEIGHT - PAD - 22, time);
  }

  private stub(x: number, y: number, time: number): void {
    const { brush, copy } = this;
    const { ctx } = brush;
    brush.fillRound({ x, y, width: STUB, height: HEIGHT }, [0, RADIUS, RADIUS, 0], COLOURS.white);
    // The perforation the stub is torn along.
    ctx.save();
    ctx.strokeStyle = COLOURS.line;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x, y + HEIGHT - 6);
    ctx.stroke();
    ctx.restore();

    const centre = x + STUB / 2;
    const middle = y + HEIGHT / 2;
    brush.text(tr.route.seat, centre, middle - 34, LABEL, COLOURS.muted, 'center');
    brush.text(copy.pass.seat, centre, middle - 4, SEAT, COLOURS.asphalt, 'center');
    const [destination = ''] = brush.wrap(copy.pass.destination, DESTINATION, STUB - 12, 1);
    brush.text(destination, centre, middle + 30, DESTINATION, COLOURS.asphalt, 'center');

    // The hole left by the conductor's punch.
    const punched = clamp01((time - PASS_TIMING.punchAt) / 0.1);
    if (punched > 0) {
      ctx.save();
      ctx.globalAlpha *= punched;
      ctx.fillStyle = 'rgb(27 31 36 / 0.8)';
      ctx.beginPath();
      ctx.arc(x + STUB - 18, y + 18, 7 * (0.3 + 0.7 * punched), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private field(
    label: string,
    value: string,
    x: number,
    top: number,
    align: CanvasTextAlign = 'left',
  ): void {
    this.brush.text(label, x, top + 7, LABEL, COLOURS.muted, align);
    this.brush.text(value, x, top + 24, VALUE, COLOURS.asphalt, align);
  }

  private barcode(x: number, y: number, width: number, height: number): void {
    const { ctx } = this.brush;
    ctx.save();
    ctx.globalAlpha *= 0.85;
    ctx.fillStyle = COLOURS.asphalt;
    let at = x;
    for (let i = 0; at < x + width; i += 1) {
      const bar = BARS[i % BARS.length] ?? 1;
      if (i % 2 === 0) ctx.fillRect(at, y, Math.min(bar, x + width - at), height);
      at += bar;
    }
    ctx.restore();
  }

  /** The rubber stamp: it comes down fast and lands at an angle, in red ink. */
  private stamp(centreX: number, centreY: number, time: number): void {
    const landing = clamp01((time - (PASS_TIMING.stampAt - 0.17)) / 0.17);
    if (landing <= 0) return;
    const { brush } = this;
    const { ctx } = brush;
    const eased = easeIn(landing);
    const top = tr.route.stampTop;
    const bottom = tr.route.stampBottom;
    const width = Math.max(brush.measure(top, STAMP), brush.measure(bottom, STAMP)) + 22;
    const height = 46;
    brush.with(
      {
        alpha: 0.88 * eased,
        scale: 2.6 - 1.6 * eased,
        rotate: -26 + 14 * eased,
        origin: { x: centreX, y: centreY },
      },
      () => {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = COLOURS.red;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(centreX - width / 2, centreY - height / 2, width, height, 6);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(centreX - width / 2 - 4, centreY - height / 2 - 4, width + 8, height + 8, 9);
        ctx.stroke();
        brush.text(top, centreX, centreY - 9, STAMP, COLOURS.red, 'center');
        brush.text(bottom, centreX, centreY + 9, STAMP, COLOURS.red, 'center');
        ctx.restore();
      },
    );
  }
}
