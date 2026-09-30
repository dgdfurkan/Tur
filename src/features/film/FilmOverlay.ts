import type { RoutePlan, RouteStop } from '@/domain/tour/RoutePlan';
import type { FilmMoment, Storyboard } from './Storyboard';

/** When things happen to the boarding pass, in seconds from the start of its shot. */
export const PASS_TIMING = {
  arrived: 0.45,
  stampAt: 0.85,
  punchAt: 1.25,
  leaveAt: 2.05,
} as const;

/**
 * What is painted over the map at one moment. Amounts run from 0 (absent) to 1
 * (fully there); the painter turns them into movement.
 */
export interface FilmOverlay {
  /** The plate with the logo and the agency's name. */
  readonly brand: number;
  /** Day of the tour shown beside the brand, if any. */
  readonly day: number | null;
  /** The sign that opens the film with the tour's name. */
  readonly title: number;
  /** Seconds into the boarding pass scene, or null outside it. */
  readonly pass: number | null;
  /** The place the coach is at. */
  readonly place: { readonly stop: RouteStop; readonly shown: number } | null;
  /** Where the coach is heading, and how far that is in a straight line. */
  readonly heading: {
    readonly stop: RouteStop;
    readonly km: number;
    readonly shown: number;
  } | null;
  /** The sign that closes the film. */
  readonly outro: number;
}

export type SoundCue = { readonly time: number } & (
  | { readonly kind: 'stamp' | 'punch' | 'chime' }
  | { readonly kind: 'engine'; readonly level: number }
);

const ENGINE_DRIVING = 1;
const ENGINE_IDLE = 0.4;

/** Rises over `rise` seconds at the start of a shot and falls over `fall` seconds at its end. */
function envelope(moment: FilmMoment, rise: number, fall: number): number {
  const { seconds } = moment.shot;
  // A very short shot shares its time between coming and going.
  const up = Math.min(rise, seconds * 0.4);
  const down = Math.min(fall, seconds * 0.4);
  const rising = up === 0 ? 1 : Math.min(1, moment.local / up);
  const falling = down === 0 ? 1 : Math.min(1, (seconds - moment.local) / down);
  return Math.max(0, Math.min(rising, falling));
}

const NOTHING: FilmOverlay = {
  brand: 1,
  day: null,
  title: 0,
  pass: null,
  place: null,
  heading: null,
  outro: 0,
};

/** What is painted over the map at a moment of the film. */
export function overlayAt(moment: FilmMoment, plan: RoutePlan): FilmOverlay {
  const { shot } = moment;
  switch (shot.kind) {
    case 'title':
      return {
        ...NOTHING,
        brand: Math.min(1, moment.local / 0.4),
        title: envelope(moment, 0.55, 0.3),
      };
    case 'boarding':
      return { ...NOTHING, pass: moment.local };
    case 'drive': {
      const next = plan.stops[shot.legIndex + 1];
      if (!next) return NOTHING;
      return {
        ...NOTHING,
        day: next.day,
        heading: { stop: next, km: plan.legKm(shot.legIndex), shown: envelope(moment, 0.3, 0.2) },
      };
    }
    case 'stop': {
      const stop = plan.stops[shot.stopIndex];
      if (!stop) return NOTHING;
      return { ...NOTHING, day: stop.day, place: { stop, shown: envelope(moment, 0.4, 0.28) } };
    }
    case 'trace':
      return NOTHING;
    case 'outro':
      return { ...NOTHING, brand: 0, outro: Math.min(1, moment.local / 0.6) };
  }
}

/** The sounds of a film, in the order they are heard. */
export function soundCues(storyboard: Storyboard): SoundCue[] {
  return storyboard.shots.flatMap((shot): SoundCue[] => {
    const time = shot.start;
    switch (shot.kind) {
      case 'title':
        return [];
      case 'boarding':
        return [
          { kind: 'stamp', time: time + PASS_TIMING.stampAt },
          { kind: 'punch', time: time + PASS_TIMING.punchAt },
        ];
      case 'drive':
      case 'trace':
        return [{ kind: 'engine', time, level: ENGINE_DRIVING }];
      case 'stop':
        return [
          { kind: 'engine', time, level: ENGINE_IDLE },
          { kind: 'chime', time },
        ];
      case 'outro':
        return [
          { kind: 'engine', time, level: 0 },
          { kind: 'chime', time },
        ];
    }
  });
}
