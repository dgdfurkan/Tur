import type { ViewPadding } from '@/shared/lifecycle';
import type { FilmFormat } from './formats';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where everything sits in a frame, in layout pixels. The margins keep clear
 * of what Instagram draws over a Reel: its header at the top, the caption and
 * buttons at the bottom.
 */
export interface FilmLayout {
  readonly format: FilmFormat;
  /** Top-left corner of the brand plate. */
  readonly brand: { readonly x: number; readonly y: number };
  /** Right edge and top of the day badge. */
  readonly badge: { readonly right: number; readonly y: number };
  /** The opening and closing signs fill this width from this top edge; their height follows their text. */
  readonly sign: { readonly x: number; readonly y: number; readonly width: number };
  /** The card about a place. */
  readonly card: {
    readonly frame: Rect;
    readonly art: Rect;
    readonly text: Rect;
  };
  /** The sign naming the next stop is centred on this point, which is its bottom edge. */
  readonly heading: { readonly centre: number; readonly bottom: number; readonly maxWidth: number };
  /** Room the map leaves for each of these, so the route or the coach is never under them. */
  readonly framing: {
    readonly overview: ViewPadding;
    readonly drive: ViewPadding;
    readonly stop: ViewPadding;
  };
}

const SIDE = 16;
const BRAND_HEIGHT = 40;
const GAP = 12;

function tall(
  format: FilmFormat,
  top: number,
  bottom: number,
  art: number,
  text: number,
): FilmLayout {
  const { width, height } = format;
  const inner = width - SIDE * 2;
  const cardHeight = art + text;
  const cardY = height - bottom - cardHeight;
  const below = top + BRAND_HEIGHT + GAP;
  return {
    format,
    brand: { x: SIDE, y: top },
    badge: { right: width - SIDE, y: top },
    sign: { x: SIDE, y: below, width: inner },
    card: {
      frame: { x: SIDE, y: cardY, width: inner, height: cardHeight },
      art: { x: SIDE, y: cardY, width: inner, height: art },
      text: { x: SIDE, y: cardY + art, width: inner, height: text },
    },
    heading: { centre: width / 2, bottom: height - bottom, maxWidth: inner },
    framing: {
      // The signs take the upper part of the frame; the route is shown below them.
      overview: { left: SIDE, right: SIDE, top: below + height * 0.3, bottom: bottom + GAP },
      drive: { left: SIDE, right: SIDE, top: below, bottom: bottom + 56 + GAP * 2 },
      stop: { left: SIDE, right: SIDE, top: below + GAP, bottom: height - cardY + GAP },
    },
  };
}

function strip(format: FilmFormat, margin: number, cardHeight: number): FilmLayout {
  const { width, height } = format;
  const inner = width - SIDE * 2;
  const cardY = height - margin - cardHeight;
  const below = margin + BRAND_HEIGHT + GAP;
  return {
    format,
    brand: { x: SIDE, y: margin },
    badge: { right: width - SIDE, y: margin },
    sign: { x: SIDE, y: below, width: inner },
    card: {
      frame: { x: SIDE, y: cardY, width: inner, height: cardHeight },
      art: { x: SIDE, y: cardY, width: cardHeight, height: cardHeight },
      text: { x: SIDE + cardHeight, y: cardY, width: inner - cardHeight, height: cardHeight },
    },
    heading: { centre: width / 2, bottom: height - margin, maxWidth: inner },
    framing: {
      overview: { left: SIDE, right: SIDE, top: below + height * 0.36, bottom: margin },
      drive: { left: SIDE, right: SIDE, top: below, bottom: margin + 56 + GAP },
      stop: { left: SIDE, right: SIDE, top: below + GAP, bottom: height - cardY + GAP },
    },
  };
}

function wide(format: FilmFormat, margin: number): FilmLayout {
  const { width, height } = format;
  const cardWidth = 220;
  const art = 124;
  const text = 118;
  const cardX = width - SIDE - cardWidth;
  const below = margin + BRAND_HEIGHT + GAP;
  const signWidth = 270;
  return {
    format,
    brand: { x: SIDE, y: margin },
    badge: { right: width - SIDE, y: margin },
    sign: { x: SIDE, y: below, width: signWidth },
    card: {
      frame: { x: cardX, y: below, width: cardWidth, height: art + text },
      art: { x: cardX, y: below, width: cardWidth, height: art },
      text: { x: cardX, y: below + art, width: cardWidth, height: text },
    },
    heading: { centre: width / 2, bottom: height - margin, maxWidth: width - SIDE * 2 },
    framing: {
      // The signs stand on the left; the route is shown beside them.
      overview: { left: SIDE + signWidth + GAP, right: SIDE, top: margin, bottom: margin },
      drive: { left: SIDE, right: SIDE, top: below, bottom: margin + 56 + GAP },
      stop: { left: SIDE, right: width - cardX + GAP, top: below, bottom: margin },
    },
  };
}

/** Lays out a frame of the given shape. */
export function layoutFor(format: FilmFormat): FilmLayout {
  switch (format.id) {
    case 'reels':
      return tall(format, 76, 116, 140, 122);
    case 'portrait':
      return tall(format, 14, 14, 96, 112);
    case 'square':
      return strip(format, 14, 116);
    case 'wide':
      return wide(format, 14);
  }
}
