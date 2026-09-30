import type { PlanePoint } from './MapProjection';

/** One cubic Bézier piece of a smooth route, from one point to the next. */
export interface CurveSegment {
  readonly from: PlanePoint;
  readonly control1: PlanePoint;
  readonly control2: PlanePoint;
  readonly to: PlanePoint;
}

const format = (value: number): string => value.toFixed(1);
const pair = (point: PlanePoint): string => `${format(point.x)},${format(point.y)}`;

/**
 * Smooth curve through every point, as one segment per consecutive pair. Each
 * handle is one third of its own segment long, so a short hop after a long leg
 * cannot overshoot, and two points in the same place give a zero-length segment.
 */
export function smoothSegments(points: readonly PlanePoint[]): CurveSegment[] {
  const tangentAt = (index: number): PlanePoint => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    if (!before || !after) return { x: 0, y: 0 };
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy);
    return length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };
  };

  const segments: CurveSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    if (!from || !to) continue;
    const handle = Math.hypot(to.x - from.x, to.y - from.y) / 3;
    const out = tangentAt(i);
    const into = tangentAt(i + 1);
    segments.push({
      from,
      control1: { x: from.x + out.x * handle, y: from.y + out.y * handle },
      control2: { x: to.x - into.x * handle, y: to.y - into.y * handle },
      to,
    });
  }
  return segments;
}

/** SVG path data for a single segment, starting with its own move command. */
export function segmentPath(segment: CurveSegment): string {
  return `M${pair(segment.from)}C${pair(segment.control1)} ${pair(segment.control2)} ${pair(segment.to)}`;
}

/** SVG path data for the whole curve. */
export function smoothPath(points: readonly PlanePoint[]): string {
  const first = points[0];
  if (!first) return '';
  return (
    `M${pair(first)}` +
    smoothSegments(points)
      .map((segment) => `C${pair(segment.control1)} ${pair(segment.control2)} ${pair(segment.to)}`)
      .join('')
  );
}
