import type { PlanePoint } from './MapProjection';

const format = (value: number): string => value.toFixed(1);

/**
 * SVG path through every point with smooth joins. Each handle is one third of
 * its own segment long, so a short hop after a long leg cannot overshoot.
 */
export function smoothPath(points: readonly PlanePoint[]): string {
  const unique = points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });
  const first = unique[0];
  if (!first) return '';
  if (unique.length === 1) return `M${format(first.x)},${format(first.y)}`;

  const tangentAt = (index: number): PlanePoint => {
    const before = unique[Math.max(0, index - 1)];
    const after = unique[Math.min(unique.length - 1, index + 1)];
    if (!before || !after) return { x: 0, y: 0 };
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy);
    return length === 0 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };
  };

  let path = `M${format(first.x)},${format(first.y)}`;
  for (let i = 0; i < unique.length - 1; i += 1) {
    const from = unique[i];
    const to = unique[i + 1];
    if (!from || !to) continue;
    const handle = Math.hypot(to.x - from.x, to.y - from.y) / 3;
    const out = tangentAt(i);
    const into = tangentAt(i + 1);
    path +=
      `C${format(from.x + out.x * handle)},${format(from.y + out.y * handle)} ` +
      `${format(to.x - into.x * handle)},${format(to.y - into.y * handle)} ` +
      `${format(to.x)},${format(to.y)}`;
  }
  return path;
}
