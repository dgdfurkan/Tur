import type { RoutePlan, RouteStop } from '@/domain/tour/RoutePlan';
import type { StopKind } from '@/domain/tour/Tour';
import { driveSeconds } from '@/features/route-simulation/RouteSimulation';

/**
 * - `journey`: the boarding pass, then every leg and every stop.
 * - `day`: one day's legs and stops, without the boarding pass.
 * - `highlights`: a handful of the sights, one after another.
 * - `outline`: the road draws itself across the whole route.
 */
export type FilmTemplate = 'journey' | 'day' | 'highlights' | 'outline';

export type Shot =
  | { readonly kind: 'title' }
  | { readonly kind: 'boarding' }
  | { readonly kind: 'drive'; readonly legIndex: number }
  | { readonly kind: 'stop'; readonly stopIndex: number }
  | { readonly kind: 'trace' }
  | { readonly kind: 'outro' };

export type TimedShot = Shot & {
  /** Seconds from the beginning of the film. */
  readonly start: number;
  readonly seconds: number;
};

export interface FilmMoment {
  readonly shot: TimedShot;
  readonly index: number;
  /** Seconds since the shot began. */
  readonly local: number;
  /** Share of the shot that has passed, 0 to 1. */
  readonly progress: number;
}

const TITLE_SECONDS = 2.4;
const BOARDING_SECONDS = 2.6;
const OUTRO_SECONDS = 3.6;
const HIGHLIGHT_SECONDS = 2.8;
const MAX_HIGHLIGHTS = 4;
/** The road is traced at a steady pace, within limits that suit a short clip. */
const TRACE_SECONDS_PER_KM = 0.0062;
const MIN_TRACE_SECONDS = 5;
const MAX_TRACE_SECONDS = 9;

/** Long enough to read the card about the place. A film never waits at its first or last stop. */
const DWELL_SECONDS: Record<StopKind, number> = {
  departure: 0,
  rest: 1.6,
  sight: 2.8,
  lodging: 2.4,
  arrival: 0,
};

/**
 * The sights a short film shows: those there is most to say about, at most
 * four, in the order the coach reaches them.
 */
export function pickHighlights(plan: RoutePlan, limit = MAX_HIGHLIGHTS): RouteStop[] {
  const seen = new Set<string>();
  return plan.stops
    .filter((stop) => {
      if (stop.stop.kind !== 'sight' || seen.has(stop.stop.id)) return false;
      seen.add(stop.stop.id);
      return true;
    })
    .sort(
      (a, b) =>
        b.stop.facts.length - a.stop.facts.length ||
        (b.stop.durationMinutes ?? 0) - (a.stop.durationMinutes ?? 0) ||
        a.index - b.index,
    )
    .slice(0, limit)
    .sort((a, b) => a.index - b.index);
}

function shotsFor(plan: RoutePlan, template: FilmTemplate): (Shot & { seconds: number })[] {
  const title = { kind: 'title', seconds: TITLE_SECONDS } as const;
  const outro = { kind: 'outro', seconds: OUTRO_SECONDS } as const;

  if (template === 'outline') {
    const seconds = Math.min(
      MAX_TRACE_SECONDS,
      Math.max(MIN_TRACE_SECONDS, plan.totalKm * TRACE_SECONDS_PER_KM),
    );
    return [title, { kind: 'trace', seconds }, outro];
  }

  if (template === 'highlights') {
    return [
      title,
      ...pickHighlights(plan).map(
        (stop) => ({ kind: 'stop', stopIndex: stop.index, seconds: HIGHLIGHT_SECONDS }) as const,
      ),
      outro,
    ];
  }

  const journey: (Shot & { seconds: number })[] = [title];
  if (template === 'journey') journey.push({ kind: 'boarding', seconds: BOARDING_SECONDS });
  for (let legIndex = 0; legIndex < plan.legCount; legIndex += 1) {
    journey.push({ kind: 'drive', legIndex, seconds: driveSeconds(plan.legKm(legIndex)) });
    const reached = plan.stops[legIndex + 1];
    const dwell = reached ? DWELL_SECONDS[reached.stop.kind] : 0;
    // The last stop is the end of the road; the outro takes over from there.
    if (reached && dwell > 0 && legIndex + 1 < plan.stops.length - 1) {
      journey.push({ kind: 'stop', stopIndex: reached.index, seconds: dwell });
    }
  }
  journey.push(outro);
  return journey;
}

/**
 * The order and length of a film's shots. It knows nothing about drawing: it
 * only answers which shot is on screen at a given time.
 */
export class Storyboard {
  readonly shots: readonly TimedShot[];
  readonly seconds: number;

  constructor(plan: RoutePlan, template: FilmTemplate) {
    if (plan.stops.length < 2) throw new RangeError('A film needs a route of at least two stops');
    let start = 0;
    this.shots = shotsFor(plan, template).map((shot) => {
      const timed = { ...shot, start };
      start += shot.seconds;
      return timed;
    });
    this.seconds = start;
  }

  /** The shot on screen at `time`; times past the end stay on the last shot. */
  at(time: number): FilmMoment {
    const clamped = Math.min(Math.max(0, time), this.seconds);
    let index = this.shots.findIndex((shot) => clamped < shot.start + shot.seconds);
    if (index === -1) index = this.shots.length - 1;
    const shot = this.shots[index];
    if (!shot) throw new RangeError('The storyboard has no shots');
    const local = Math.min(shot.seconds, clamped - shot.start);
    return { shot, index, local, progress: shot.seconds === 0 ? 1 : local / shot.seconds };
  }

  /** Whole frames the film takes at a frame rate. */
  frameCount(frameRate: number): number {
    return Math.ceil(this.seconds * frameRate);
  }
}
