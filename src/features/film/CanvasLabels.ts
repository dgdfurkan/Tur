import type { LabelSize, LabelState, LabelSurface, LabelTone } from '@/features/map3d/LabelSurface';
import type { Brush } from './paint/Brush';
import { COLOURS, type TextStyle } from './paint/Brush';

interface Look {
  readonly style: TextStyle;
  readonly paddingX: number;
  readonly paddingY: number;
  /** Height of the post that carries the sign down to its place on the map. */
  readonly post: number;
}

interface Sign {
  readonly text: string;
  readonly tone: LabelTone;
  state: LabelState;
  x: number;
  y: number;
  shown: boolean;
  /** Fades between hidden and shown. */
  opacity: number;
  textWidth: number;
}

const LINE_HEIGHT = 1.35;
const SEA_SPACING = 0.08;
const SEA_COLOUR = '#4d7fa3';
const VISITED_PLATE = '#8a7567';
/** Seconds a sign takes to fade, as on the page. */
const FADE_SECONDS = 0.2;

/** The looks mirror route-map.css, so a film's signs match those on the site. */
const LOOKS = {
  stop: {
    style: { size: 13, weight: 650, width: 'semi-condensed' },
    paddingX: 8,
    paddingY: 2,
    post: 10,
  },
  city: {
    style: { size: 12, weight: 600, width: 'semi-condensed' },
    paddingX: 8,
    paddingY: 2,
    post: 10,
  },
  sea: { style: { size: 14, weight: 500, italic: true }, paddingX: 8, paddingY: 2, post: 0 },
  active: {
    style: { size: 16, weight: 650, width: 'semi-condensed' },
    paddingX: 12,
    paddingY: 4,
    post: 30,
  },
} as const satisfies Record<string, Look>;

function lookOf(sign: Pick<Sign, 'tone' | 'state'>): Look {
  return sign.state === 'active' ? LOOKS.active : LOOKS[sign.tone];
}

/**
 * Place-name signs painted onto a film frame. The label layer tells it where
 * each sign stands; `paint` draws them all.
 */
export class CanvasLabels implements LabelSurface {
  private readonly signs = new Map<string, Sign>();

  constructor(private readonly brush: Brush) {}

  create(id: string, text: string, tone: LabelTone): LabelSize {
    const sign: Sign = {
      text,
      tone,
      state: 'idle',
      x: 0,
      y: 0,
      shown: false,
      opacity: 0,
      textWidth: 0,
    };
    this.signs.set(id, sign);
    return this.measure(sign);
  }

  restyle(id: string, state: LabelState): LabelSize {
    const sign = this.signs.get(id);
    if (!sign) return { width: 0, height: 0 };
    sign.state = state;
    return this.measure(sign);
  }

  move(id: string, x: number, y: number): void {
    const sign = this.signs.get(id);
    if (!sign) return;
    sign.x = x;
    sign.y = y;
  }

  setShown(id: string, shown: boolean): void {
    const sign = this.signs.get(id);
    if (sign) sign.shown = shown;
  }

  destroy(id: string): void {
    this.signs.delete(id);
  }

  dispose(): void {
    this.signs.clear();
  }

  /** Lets signs fade in and out over time. */
  advance(deltaSeconds: number): void {
    const step = deltaSeconds / FADE_SECONDS;
    for (const sign of this.signs.values()) {
      const target = sign.shown ? 1 : 0;
      if (sign.opacity < target) sign.opacity = Math.min(target, sign.opacity + step);
      else if (sign.opacity > target) sign.opacity = Math.max(target, sign.opacity - step);
    }
  }

  /** Shows every sign at once at its final strength, for a single still frame. */
  settle(): void {
    for (const sign of this.signs.values()) sign.opacity = sign.shown ? 1 : 0;
  }

  paint(): void {
    // The active sign is drawn last, on top of its neighbours.
    const ordered = [...this.signs.values()].sort(
      (a, b) => Number(a.state === 'active') - Number(b.state === 'active'),
    );
    for (const sign of ordered) {
      if (sign.opacity <= 0) continue;
      this.brush.with({ alpha: sign.opacity }, () => this.paintSign(sign));
    }
  }

  private measure(sign: Sign): LabelSize {
    const look = lookOf(sign);
    const spacing = sign.tone === 'sea' ? look.style.size * SEA_SPACING * sign.text.length : 0;
    sign.textWidth = this.brush.measure(sign.text, look.style) + spacing;
    return {
      width: sign.textWidth + look.paddingX * 2,
      height: look.style.size * LINE_HEIGHT + look.paddingY * 2 + look.post,
    };
  }

  private paintSign(sign: Sign): void {
    const { brush } = this;
    const { ctx } = brush;
    const look = lookOf(sign);
    const width = sign.textWidth + look.paddingX * 2;
    const height = look.style.size * LINE_HEIGHT + look.paddingY * 2;
    const left = sign.x - width / 2;
    const top = sign.y - look.post - height;
    const middle = top + height / 2;

    if (sign.tone === 'sea') {
      ctx.save();
      ctx.letterSpacing = `${(look.style.size * SEA_SPACING).toFixed(2)}px`;
      brush.text(sign.text, sign.x, middle, look.style, SEA_COLOUR, 'center');
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = COLOURS.asphalt;
    ctx.fillRect(sign.x - 1, sign.y - look.post, 2, look.post);
    ctx.restore();

    const plate =
      sign.state === 'visited'
        ? VISITED_PLATE
        : sign.tone === 'city'
          ? COLOURS.blue
          : COLOURS.brown;
    const active = sign.state === 'active';
    ctx.save();
    ctx.shadowColor = active ? 'rgb(27 31 36 / 0.35)' : 'rgb(27 31 36 / 0.3)';
    ctx.shadowBlur = active ? 12 : 6;
    ctx.shadowOffsetY = active ? 4 : 2;
    // The rings around the plate, from the outside in: a yellow one for the active stop, then the plate's own colour.
    if (active) {
      brush.fillRound(
        { x: left - 5, y: top - 5, width: width + 10, height: height + 10 },
        11,
        COLOURS.yellow,
      );
    }
    brush.fillRound({ x: left - 2, y: top - 2, width: width + 4, height: height + 4 }, 8, plate);
    ctx.restore();

    ctx.beginPath();
    ctx.roundRect(left + 0.5, top + 0.5, width - 1, height - 1, 5.5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLOURS.white;
    ctx.stroke();
    brush.text(sign.text, sign.x, middle, look.style, COLOURS.white, 'center');
  }
}
