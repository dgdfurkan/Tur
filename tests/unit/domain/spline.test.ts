import { describe, expect, it } from 'vitest';
import { segmentPath, smoothPath, smoothSegments } from '@/domain/geo/spline';

describe('smoothPath', () => {
  it('returns an empty path without points', () => {
    expect(smoothPath([])).toBe('');
  });

  it('starts at the first point and ends at the last', () => {
    const path = smoothPath([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 30 },
    ]);
    expect(path.startsWith('M0.0,0.0')).toBe(true);
    expect(path.endsWith('30.0,30.0')).toBe(true);
    expect(path.match(/C/g)).toHaveLength(2);
  });

  it('keeps handles within a third of each segment', () => {
    const path = smoothPath([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 303, y: 0 },
    ]);
    // Second segment is 3 units long, so its handles sit 1 unit from the ends.
    expect(path.endsWith('C301.0,0.0 302.0,0.0 303.0,0.0')).toBe(true);
  });
});

describe('smoothSegments', () => {
  it('returns one segment per consecutive pair of points', () => {
    const segments = smoothSegments([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(segments).toHaveLength(2);
    expect(segments[0]?.to).toEqual(segments[1]?.from);
  });

  it('gives two points in the same place a zero-length segment', () => {
    const [, still] = smoothSegments([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 5 },
    ]);
    expect(still && segmentPath(still)).toBe('M10.0,0.0C10.0,0.0 10.0,0.0 10.0,0.0');
  });
});
