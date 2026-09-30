import { describe, expect, it } from 'vitest';
import {
  coachScale,
  markerScale,
  roadScale,
  COACH_LENGTH,
  ROAD_WIDTH,
  type MapView,
} from '@/features/map3d/world';

/** A view through a 32 degree lens onto a canvas of the given height. */
function view(distance: number, canvasHeight = 800): MapView {
  const halfFov = Math.tan((16 * Math.PI) / 180);
  return { distance, unitsPerPixel: (2 * distance * halfFov) / canvasHeight };
}

function pixels(worldSize: number, at: MapView): number {
  return worldSize / at.unitsPerPixel;
}

describe('map symbol scales', () => {
  it('keeps the coach the same size on screen while the camera pulls back', () => {
    const near = view(30);
    const far = view(90);
    expect(pixels(coachScale(near) * COACH_LENGTH, near)).toBeCloseTo(
      pixels(coachScale(far) * COACH_LENGTH, far),
    );
    expect(markerScale(far)).toBeGreaterThan(markerScale(near));
  });

  it('stops symbols from growing on screen in a close-up', () => {
    const usual = view(12);
    const close = view(7);
    expect(coachScale(close)).toBeLessThan(coachScale(usual));
    expect(pixels(coachScale(close), close)).toBeCloseTo(pixels(coachScale(usual), usual));
    expect(pixels(roadScale(close) * ROAD_WIDTH, close)).toBeCloseTo(
      pixels(roadScale(usual) * ROAD_WIDTH, usual),
    );
  });

  it('leaves the road at its natural width at middle distances', () => {
    expect(roadScale(view(12))).toBe(1);
    expect(roadScale(view(40))).toBe(1);
  });

  it('holds a minimum size on screen from far away or on a small canvas', () => {
    const phone = view(370, 360);
    expect(pixels(roadScale(phone) * ROAD_WIDTH, phone)).toBeCloseTo(5);
    expect(pixels(coachScale(phone) * COACH_LENGTH, phone)).toBeCloseTo(22);
    expect(markerScale(phone)).toBeGreaterThan(3.4);
  });
});
