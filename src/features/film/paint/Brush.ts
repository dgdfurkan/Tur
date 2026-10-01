import type { Rect } from '../FilmLayout';

/** Width of the typeface; a canvas only understands the named steps of the width axis. */
export type FontWidth = 'condensed' | 'semi-condensed' | 'normal';

export interface TextStyle {
  readonly size: number;
  readonly weight: number;
  readonly width?: FontWidth;
  readonly italic?: boolean;
}

export interface Transform {
  readonly alpha?: number;
  readonly dx?: number;
  readonly dy?: number;
  readonly scale?: number;
  /** Degrees, clockwise. */
  readonly rotate?: number;
  /** The point that scaling and rotation turn about. */
  readonly origin?: { readonly x: number; readonly y: number };
}

export const COLOURS = {
  asphalt: '#1b1f24',
  white: '#ffffff',
  muted: '#56606b',
  line: '#d8dee4',
  blue: '#0b5a8f',
  brown: '#74462a',
  yellow: '#f2b705',
  red: '#c0161c',
} as const;

const ELLIPSIS = '…';

/**
 * The few drawing moves the film's signs and cards are made of, on a 2D canvas.
 * Everything is measured in layout pixels; whoever owns the canvas scales it to
 * the file's pixel size.
 */
export class Brush {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    private readonly family: string,
  ) {
    ctx.textBaseline = 'middle';
  }

  font(style: TextStyle): void {
    const { size, weight, width = 'normal', italic = false } = style;
    this.ctx.font = `${italic ? 'italic ' : ''}${weight} ${width} ${size}px ${this.family}`;
  }

  measure(text: string, style: TextStyle): number {
    this.font(style);
    return this.ctx.measureText(text).width;
  }

  /**
   * Breaks text into lines no wider than `maxWidth`. When there is more text
   * than `maxLines` can hold, the last line ends in an ellipsis.
   */
  wrap(text: string, style: TextStyle, maxWidth: number, maxLines: number): string[] {
    this.font(style);
    const width = (value: string): number => this.ctx.measureText(value).width;
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const candidate = line === '' ? word : `${line} ${word}`;
      if (line === '' || width(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      lines.push(line);
      line = word;
    }
    if (line !== '') lines.push(line);
    if (lines.length <= maxLines) return lines.map((value) => this.fit(value, maxWidth));

    const kept = lines.slice(0, maxLines);
    let last = `${kept[maxLines - 1] ?? ''}${ELLIPSIS}`;
    while (last.length > 1 && width(last) > maxWidth)
      last = `${last.slice(0, -2).trimEnd()}${ELLIPSIS}`;
    kept[maxLines - 1] = last;
    return kept;
  }

  /** Shortens a single line with an ellipsis until it fits. The font must already be set. */
  private fit(text: string, maxWidth: number): string {
    if (this.ctx.measureText(text).width <= maxWidth) return text;
    let cut = text;
    while (cut.length > 1 && this.ctx.measureText(`${cut}${ELLIPSIS}`).width > maxWidth) {
      cut = cut.slice(0, -1).trimEnd();
    }
    return `${cut}${ELLIPSIS}`;
  }

  /** Writes one line; `y` is the middle of the line. */
  text(
    text: string,
    x: number,
    y: number,
    style: TextStyle,
    colour: string,
    align: CanvasTextAlign = 'left',
  ): void {
    this.font(style);
    this.ctx.fillStyle = colour;
    this.ctx.textAlign = align;
    // Capitals sit a little above the middle of the em box; this centres them by eye.
    this.ctx.fillText(text, x, y + style.size * 0.04);
  }

  /** Writes lines one under another from `top`; returns the height used. */
  block(
    lines: readonly string[],
    x: number,
    top: number,
    style: TextStyle,
    colour: string,
    lineHeight: number,
  ): number {
    const step = style.size * lineHeight;
    lines.forEach((line, index) => this.text(line, x, top + step * (index + 0.5), style, colour));
    return step * lines.length;
  }

  fillRound(rect: Rect, radius: number | readonly number[], colour: string): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius as number | number[]);
    ctx.fillStyle = colour;
    ctx.fill();
  }

  /** A road sign: a coloured plate with a white rim set in from its edge. */
  plate(rect: Rect, colour: string, radius = 12, inset = 3.5): void {
    const { ctx } = this;
    ctx.save();
    ctx.shadowColor = 'rgb(27 31 36 / 0.28)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    this.fillRound(rect, radius, colour);
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(
      rect.x + inset,
      rect.y + inset,
      rect.width - inset * 2,
      rect.height - inset * 2,
      Math.max(1, radius - inset),
    );
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COLOURS.white;
    ctx.stroke();
  }

  /** A white card lifted off the map by a soft shadow. */
  card(rect: Rect, radius: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.shadowColor = 'rgb(27 31 36 / 0.26)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    this.fillRound(rect, radius, COLOURS.white);
    ctx.restore();
  }

  /** Draws an image so that it covers `rect`, cropped about its centre and clipped to rounded corners. */
  cover(
    image: CanvasImageSource,
    size: { width: number; height: number },
    rect: Rect,
    radius: number | readonly number[],
  ): void {
    const { ctx } = this;
    const scale = Math.max(rect.width / size.width, rect.height / size.height);
    const width = size.width * scale;
    const height = size.height * scale;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius as number | number[]);
    ctx.clip();
    ctx.drawImage(
      image,
      rect.x + (rect.width - width) / 2,
      rect.y + (rect.height - height) / 2,
      width,
      height,
    );
    ctx.restore();
  }

  /** Runs `draw` moved, turned, scaled or faded, then puts the brush back as it was. */
  with(transform: Transform, draw: () => void): void {
    const { alpha = 1, dx = 0, dy = 0, scale = 1, rotate = 0, origin } = transform;
    if (alpha <= 0) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, alpha);
    ctx.translate(dx, dy);
    if (origin && (scale !== 1 || rotate !== 0)) {
      ctx.translate(origin.x, origin.y);
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.scale(scale, scale);
      ctx.translate(-origin.x, -origin.y);
    }
    draw();
    ctx.restore();
  }
}
