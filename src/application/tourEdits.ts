import type { SeatLayoutCode } from '@/domain/vehicle/SeatLayout';
import type { DepartureData, HotelData, StopData, TourSnapshot } from './dto/TourData';

/**
 * Small, named changes to a tour, for TourCatalogEditor.change(). Each takes
 * what the change needs and returns a function from the tour to its new state.
 */
export type TourEdit = (tour: TourSnapshot) => TourSnapshot;

export const setPrice =
  (lira: number): TourEdit =>
  (tour) => ({ ...tour, pricePerPersonTry: lira });

/** `null` removes the supplement, for tours without single rooms or without nights. */
export const setSingleSupplement =
  (lira: number | null): TourEdit =>
  (tour) => {
    const next = { ...tour };
    if (lira === null) delete next.singleSupplementTry;
    else next.singleSupplementTry = lira;
    return next;
  };

export type TourDetails = Pick<
  TourSnapshot,
  'title' | 'destination' | 'summary' | 'category' | 'scene' | 'distanceFromAnkaraKm'
> & { seatLayout: SeatLayoutCode };

export const setDetails =
  (details: Partial<TourDetails>): TourEdit =>
  (tour) => ({ ...tour, ...details });

/** Adds the departure, or replaces the one with the same id. Departures stay in date order. */
export const saveDeparture =
  (departure: DepartureData): TourEdit =>
  (tour) => ({
    ...tour,
    departures: [...tour.departures.filter((item) => item.id !== departure.id), departure].sort(
      (a, b) => a.startDate.localeCompare(b.startDate) || a.time.localeCompare(b.time),
    ),
  });

export const removeDeparture =
  (departureId: string): TourEdit =>
  (tour) => ({ ...tour, departures: tour.departures.filter((item) => item.id !== departureId) });

export const setList =
  (list: 'included' | 'excluded', items: readonly string[]): TourEdit =>
  (tour) => ({ ...tour, [list]: [...items] });

export const setHotels =
  (hotels: readonly HotelData[]): TourEdit =>
  (tour) => ({ ...tour, hotels: [...hotels] });

export const setDay =
  (dayIndex: number, day: { title: string; summary: string }): TourEdit =>
  (tour) => ({
    ...tour,
    days: tour.days.map((item, index) => (index === dayIndex ? { ...item, ...day } : item)),
  });

/** Changes what is told about a stop; where it is and what kind of stop it is stay as they are. */
export const setStop =
  (
    dayIndex: number,
    stopIndex: number,
    stop: Partial<Pick<StopData, 'name' | 'summary' | 'scene' | 'durationMinutes' | 'facts'>>,
  ): TourEdit =>
  (tour) => ({
    ...tour,
    days: tour.days.map((day, index) =>
      index !== dayIndex
        ? day
        : {
            ...day,
            stops: day.stops.map((item, position) => {
              if (position !== stopIndex) return item;
              const next: StopData = { ...item, ...stop };
              // An emptied duration or list of facts is left out rather than stored empty.
              if (next.durationMinutes === undefined) delete next.durationMinutes;
              if (next.facts?.length === 0) delete next.facts;
              return next;
            }),
          },
    ),
  });

/** One calendar day later or earlier; dates are plain YYYY-MM-DD strings in UTC. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** An id for a new departure of the tour that no other departure of it uses. */
export function newDepartureId(tour: TourSnapshot, startDate: string): string {
  const taken = new Set(tour.departures.map((departure) => departure.id));
  const base = `${tour.id}-${startDate}`;
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
