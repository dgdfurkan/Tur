import type { GeoPoint } from '../geo/GeoPoint';
import type { Money } from '../shared/Money';
import type { Departure } from './Departure';
import { rankSights } from './highlights';

export type TourCategory = 'kultur' | 'doga' | 'gunubirlik';
export type StopKind = 'departure' | 'sight' | 'rest' | 'lodging' | 'arrival';
export type EmblemKey = 'peribacasi' | 'yayla' | 'antik-kent' | 'konak' | 'vadi';

/** The illustrations a place can be shown with; each key has a drawing in the presentation layer. */
export const SCENE_KEYS = [
  'sehir',
  'mola',
  'otel',
  'seyir',
  'konak',
  'carsi',
  'vadi',
  'tuz-golu',
  'kervansaray',
  'yeralti',
  'kaya-kilise',
  'kaya-kale',
  'peribacasi',
  'uc-guzeller',
  'comlek',
  'tas-konak',
  'traverten',
  'antik-tiyatro',
  'kutuphane',
  'sapel',
  'koy',
  'saat-kulesi',
  'sutunlar',
  'tumulus',
  'vapur',
  'teleferik',
  'sahil-kalesi',
  'ayasofya',
  'kosk',
  'manastir',
  'gol',
  'cay',
  'tas-kopru',
  'orman-kalesi',
  'selale',
  'yayla',
  'su-kemeri',
] as const;
export type SceneKey = (typeof SCENE_KEYS)[number];

/** A short fact about a place: what it is about and the figure or name that answers it. */
export interface StopFact {
  readonly label: string;
  readonly value: string;
}

export interface Stop {
  readonly id: string;
  readonly name: string;
  readonly kind: StopKind;
  readonly location: GeoPoint;
  readonly summary: string;
  readonly scene: SceneKey;
  readonly facts: readonly StopFact[];
  readonly durationMinutes?: number;
}

export interface TourDay {
  readonly number: number;
  readonly title: string;
  readonly summary: string;
  readonly stops: readonly Stop[];
}

export interface Hotel {
  readonly name: string;
  readonly location: string;
  readonly stars: number;
  readonly nights: number;
  readonly board: string;
}

export interface TourProps {
  readonly id: string;
  readonly title: string;
  readonly category: TourCategory;
  readonly summary: string;
  readonly emblem: EmblemKey;
  /** The illustration that stands for the whole tour. */
  readonly scene: SceneKey;
  readonly destination: string;
  readonly nights: number;
  readonly distanceFromOriginKm: number;
  readonly price: Money;
  readonly singleSupplement: Money | null;
  readonly included: readonly string[];
  readonly excluded: readonly string[];
  readonly hotels: readonly Hotel[];
  readonly days: readonly TourDay[];
  readonly departures: readonly Departure[];
}

/** Roads are longer than the straight lines between stops. */
export const ROAD_WINDING_FACTOR = 1.3;

/** The road distance for a straight-line distance, rounded to a figure that reads naturally. */
export function roadKm(straightKm: number): number {
  const km = straightKm * ROAD_WINDING_FACTOR;
  if (km < 10) return Math.max(1, Math.round(km));
  return km < 200 ? Math.round(km / 5) * 5 : Math.round(km / 10) * 10;
}

export class Tour {
  readonly id: string;
  readonly title: string;
  readonly category: TourCategory;
  readonly summary: string;
  readonly emblem: EmblemKey;
  readonly scene: SceneKey;
  readonly destination: string;
  readonly nights: number;
  readonly distanceFromOriginKm: number;
  readonly price: Money;
  readonly singleSupplement: Money | null;
  readonly included: readonly string[];
  readonly excluded: readonly string[];
  readonly hotels: readonly Hotel[];
  readonly days: readonly TourDay[];
  readonly departures: readonly Departure[];

  constructor(props: TourProps) {
    if (props.days.length === 0) {
      throw new RangeError(`Tour ${props.id} has no days`);
    }
    if (props.days.some((day) => day.stops.length === 0)) {
      throw new RangeError(`Tour ${props.id} has a day without stops`);
    }
    this.id = props.id;
    this.title = props.title;
    this.category = props.category;
    this.summary = props.summary;
    this.emblem = props.emblem;
    this.scene = props.scene;
    this.destination = props.destination;
    this.nights = props.nights;
    this.distanceFromOriginKm = props.distanceFromOriginKm;
    this.price = props.price;
    this.singleSupplement = props.singleSupplement;
    this.included = props.included;
    this.excluded = props.excluded;
    this.hotels = props.hotels;
    this.days = props.days;
    this.departures = [...props.departures].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  get dayCount(): number {
    return this.days.length;
  }

  get isDayTrip(): boolean {
    return this.nights === 0;
  }

  /** Every stop of every day, in travel order. */
  get stops(): readonly Stop[] {
    return this.days.flatMap((day) => day.stops);
  }

  get sightCount(): number {
    return this.stops.filter((stop) => stop.kind === 'sight').length;
  }

  /**
   * The sights to show beside the tour's own picture: those there is most to
   * say about, each with a picture not shown already, in travel order.
   */
  highlights(limit: number): readonly Stop[] {
    const shown = new Set<SceneKey>([this.scene]);
    const picked: Stop[] = [];
    for (const stop of rankSights(this.stops)) {
      if (picked.length === limit) break;
      if (shown.has(stop.scene)) continue;
      shown.add(stop.scene);
      picked.push(stop);
    }
    const order = this.stops;
    return picked.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }

  /** Approximate road distance of the whole route. */
  get routeDistanceKm(): number {
    const stops = this.stops;
    let straight = 0;
    for (let i = 1; i < stops.length; i += 1) {
      const from = stops[i - 1];
      const to = stops[i];
      if (from && to) straight += from.location.distanceKmTo(to.location);
    }
    return roadKm(straight);
  }

  upcomingDepartures(today: string): readonly Departure[] {
    return this.departures.filter((departure) => departure.isUpcoming(today));
  }

  nextDeparture(today: string): Departure | undefined {
    return this.upcomingDepartures(today)[0];
  }

  findDeparture(departureId: string): Departure | undefined {
    return this.departures.find((departure) => departure.id === departureId);
  }
}
