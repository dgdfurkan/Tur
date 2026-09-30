import type { Stop } from './Tour';

/**
 * The sights among the given stops, those there is most to say about first:
 * more facts, then a longer visit, then the earlier one. A place visited twice
 * counts once.
 */
export function rankSights(stops: readonly Stop[]): Stop[] {
  const sights = new Map<string, { stop: Stop; order: number }>();
  stops.forEach((stop, order) => {
    if (stop.kind === 'sight' && !sights.has(stop.id)) sights.set(stop.id, { stop, order });
  });
  return [...sights.values()]
    .sort(
      (a, b) =>
        b.stop.facts.length - a.stop.facts.length ||
        (b.stop.durationMinutes ?? 0) - (a.stop.durationMinutes ?? 0) ||
        a.order - b.order,
    )
    .map((entry) => entry.stop);
}
