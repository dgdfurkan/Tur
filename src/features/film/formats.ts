/** The shape of a film frame, measured in layout pixels like a phone screen. */
export interface FilmFormat {
  readonly id: 'reels' | 'portrait' | 'square' | 'wide';
  /** Size in layout pixels; text and signs are sized in these, so they read well on a phone. */
  readonly width: number;
  readonly height: number;
}

/** How many device pixels each layout pixel becomes in the file. */
export interface FilmQuality {
  readonly id: '4k' | 'hd';
  readonly pixelRatio: number;
  /** Megabits per second for a frame the size of 9:16. */
  readonly megabits: number;
}

export const FILM_FORMATS: readonly FilmFormat[] = [
  { id: 'reels', width: 360, height: 640 },
  { id: 'portrait', width: 360, height: 450 },
  { id: 'square', width: 360, height: 360 },
  { id: 'wide', width: 640, height: 360 },
];

export const FILM_QUALITIES: readonly FilmQuality[] = [
  { id: '4k', pixelRatio: 6, megabits: 36 },
  { id: 'hd', pixelRatio: 3, megabits: 12 },
];

export const FRAME_RATES = [30, 60] as const;
export type FrameRate = (typeof FRAME_RATES)[number];

const REELS_AREA = 360 * 640;

/** Pixel size of the file for a format at a quality: 2160×3840 for 4K Reels. */
export function pixelSize(
  format: FilmFormat,
  quality: FilmQuality,
): { width: number; height: number } {
  return {
    width: format.width * quality.pixelRatio,
    height: format.height * quality.pixelRatio,
  };
}

/** Bits per second, in proportion to the frame's area and rate. */
export function bitrate(format: FilmFormat, quality: FilmQuality, frameRate: FrameRate): number {
  const area = (format.width * format.height) / REELS_AREA;
  const motion = frameRate === 60 ? 1.4 : 1;
  return Math.round(quality.megabits * 1_000_000 * area * motion);
}
