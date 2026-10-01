import type { JourneySnapshot, MomentData } from './dto/JourneyData';

/*
 * Changes to a journey, each written as a function the archive editor applies
 * to a copy. The editor checks the result; these only describe the change.
 */

type Edit = (journey: JourneySnapshot) => JourneySnapshot;

export type JourneyDetails = Partial<
  Pick<
    JourneySnapshot,
    'title' | 'scene' | 'startDate' | 'endDate' | 'group' | 'guests' | 'distanceKm' | 'story'
  >
>;

export function setJourneyDetails(details: JourneyDetails): Edit {
  return (journey) => ({ ...journey, ...details });
}

/** Adds a moment, or replaces the one at `index`. */
export function saveMoment(index: number | null, moment: MomentData): Edit {
  return (journey) => ({
    ...journey,
    moments:
      index === null
        ? [...journey.moments, moment]
        : journey.moments.map((item, at) => (at === index ? moment : item)),
  });
}

export function removeMoment(index: number): Edit {
  return (journey) => ({
    ...journey,
    moments: journey.moments.filter((_, at) => at !== index),
  });
}
