import type { SceneKey } from '../tour/Tour';

/** Who travelled: anyone who booked a seat, a school class or the staff of an institution. */
export const JOURNEY_GROUPS = ['genel', 'okul', 'kurum'] as const;
export type JourneyGroup = (typeof JOURNEY_GROUPS)[number];

/** Something remembered from the road: where it was, on which day, and what happened there. */
export interface Moment {
  /** 1 for the first day of the journey. */
  readonly day: number;
  readonly place: string;
  readonly scene: SceneKey;
  /** May be empty: a place can be remembered by its picture alone. */
  readonly note: string;
}

export interface JourneyProps {
  readonly id: string;
  /** The tour this was a run of. It may since have changed or been withdrawn. */
  readonly tourId: string;
  /** The tour's name as it was at the time. */
  readonly title: string;
  readonly scene: SceneKey;
  /** ISO calendar dates (YYYY-MM-DD). */
  readonly startDate: string;
  readonly endDate: string;
  readonly group: JourneyGroup;
  readonly guests: number;
  readonly distanceKm: number;
  readonly story: string;
  readonly moments: readonly Moment[];
}

const DAY_MS = 86_400_000;

/**
 * A run of a tour that has been completed, as the office tells it afterwards.
 * It keeps its own copy of what it needs, so changing a tour's programme later
 * never rewrites a journey that already happened.
 */
export class Journey {
  readonly id: string;
  readonly tourId: string;
  readonly title: string;
  readonly scene: SceneKey;
  readonly startDate: string;
  readonly endDate: string;
  readonly group: JourneyGroup;
  readonly guests: number;
  readonly distanceKm: number;
  readonly story: string;
  /** In the order of the days; moments of the same day keep the order they were given in. */
  readonly moments: readonly Moment[];

  constructor(props: JourneyProps) {
    if (props.endDate < props.startDate) {
      throw new RangeError(`Journey ${props.id} ends before it starts`);
    }
    if (!Number.isInteger(props.guests) || props.guests < 1) {
      throw new RangeError(`Journey ${props.id} must have at least one guest`);
    }
    if (!Number.isInteger(props.distanceKm) || props.distanceKm < 1) {
      throw new RangeError(`Journey ${props.id} must have a positive distance`);
    }
    this.id = props.id;
    this.tourId = props.tourId;
    this.title = props.title;
    this.scene = props.scene;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.group = props.group;
    this.guests = props.guests;
    this.distanceKm = props.distanceKm;
    this.story = props.story;
    for (const moment of props.moments) {
      if (!Number.isInteger(moment.day) || moment.day < 1 || moment.day > this.dayCount) {
        throw new RangeError(`Journey ${props.id} has a moment on day ${moment.day}`);
      }
    }
    this.moments = [...props.moments].sort((a, b) => a.day - b.day);
  }

  get dayCount(): number {
    return Math.round((Date.parse(this.endDate) - Date.parse(this.startDate)) / DAY_MS) + 1;
  }

  get nights(): number {
    return this.dayCount - 1;
  }

  get year(): number {
    return Number(this.startDate.slice(0, 4));
  }

  /** The calendar date of a day of the journey, 1 being the first. */
  dateOfDay(day: number): string {
    return new Date(Date.parse(this.startDate) + (day - 1) * DAY_MS).toISOString().slice(0, 10);
  }
}

/** What a set of journeys adds up to. */
export interface JourneyTotals {
  readonly count: number;
  readonly guests: number;
  readonly distanceKm: number;
}

export function totalsOf(journeys: readonly Journey[]): JourneyTotals {
  return {
    count: journeys.length,
    guests: journeys.reduce((sum, journey) => sum + journey.guests, 0),
    distanceKm: journeys.reduce((sum, journey) => sum + journey.distanceKm, 0),
  };
}

/** The latest journey first. */
export function byLatest(a: Journey, b: Journey): number {
  return b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id);
}
