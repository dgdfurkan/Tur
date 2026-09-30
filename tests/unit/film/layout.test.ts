import { describe, expect, it } from 'vitest';
import { layoutFor } from '@/features/film/FilmLayout';
import {
  bitrate,
  FILM_FORMATS,
  FILM_QUALITIES,
  pixelSize,
  type FilmFormat,
  type FilmQuality,
} from '@/features/film/formats';

const format = (id: FilmFormat['id']): FilmFormat => {
  const found = FILM_FORMATS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No format ${id}`);
  return found;
};
const quality = (id: FilmQuality['id']): FilmQuality => {
  const found = FILM_QUALITIES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No quality ${id}`);
  return found;
};

describe('film formats', () => {
  it('gives the pixel sizes Instagram and wide screens expect', () => {
    expect(pixelSize(format('reels'), quality('4k'))).toEqual({ width: 2160, height: 3840 });
    expect(pixelSize(format('reels'), quality('hd'))).toEqual({ width: 1080, height: 1920 });
    expect(pixelSize(format('portrait'), quality('hd'))).toEqual({ width: 1080, height: 1350 });
    expect(pixelSize(format('square'), quality('4k'))).toEqual({ width: 2160, height: 2160 });
    expect(pixelSize(format('wide'), quality('4k'))).toEqual({ width: 3840, height: 2160 });
  });

  it('keeps every size even, as H.264 requires', () => {
    for (const candidate of FILM_FORMATS) {
      for (const level of FILM_QUALITIES) {
        const size = pixelSize(candidate, level);
        expect(size.width % 2).toBe(0);
        expect(size.height % 2).toBe(0);
      }
    }
  });

  it('spends bits in proportion to the frame', () => {
    const reels = bitrate(format('reels'), quality('4k'), 30);
    expect(reels).toBe(36_000_000);
    expect(bitrate(format('square'), quality('4k'), 30)).toBeLessThan(reels);
    expect(bitrate(format('reels'), quality('hd'), 30)).toBeLessThan(reels);
    expect(bitrate(format('reels'), quality('4k'), 60)).toBeGreaterThan(reels);
  });
});

describe('layoutFor', () => {
  it.each(FILM_FORMATS)(
    'keeps the $id card inside the frame and leaves the map room',
    (candidate) => {
      const layout = layoutFor(candidate);
      const { frame, art, text } = layout.card;
      expect(frame.x).toBeGreaterThanOrEqual(0);
      expect(frame.y).toBeGreaterThan(0);
      expect(frame.x + frame.width).toBeLessThanOrEqual(candidate.width);
      expect(frame.y + frame.height).toBeLessThanOrEqual(candidate.height);
      expect(art.width * art.height + text.width * text.height).toBeCloseTo(
        frame.width * frame.height,
      );

      for (const padding of Object.values(layout.framing)) {
        expect(candidate.width - padding.left - padding.right).toBeGreaterThan(80);
        expect(candidate.height - padding.top - padding.bottom).toBeGreaterThan(80);
      }
    },
  );

  it('stays clear of what Instagram draws over a Reel', () => {
    const layout = layoutFor(format('reels'));
    expect(layout.brand.y).toBeGreaterThanOrEqual(70);
    expect(640 - (layout.card.frame.y + layout.card.frame.height)).toBeGreaterThanOrEqual(110);
  });
});
