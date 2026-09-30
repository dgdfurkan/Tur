import { describe, expect, it } from 'vitest';
import { smoothPath } from '@/domain/geo/spline';

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

  it('ignores consecutive duplicate points', () => {
    const path = smoothPath([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(path.match(/C/g)).toHaveLength(1);
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
