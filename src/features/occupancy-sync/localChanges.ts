import type { SafeStorage } from '@/infrastructure/storage/SafeStorage';
import { SITE_SETTINGS_KEY, TOUR_DRAFTS_KEY } from '@/infrastructure/storage/keys';
import type { SeatLayoutCode } from '@/domain/vehicle/SeatLayout';

/** What the panel changed about a tour, as far as the public pages show it. */
export interface TourChanges {
  readonly priceTry: number | null;
  readonly seatLayout: SeatLayoutCode | null;
  /** Seats sold through other channels, by departure. */
  readonly departures: ReadonlyMap<string, readonly number[]>;
}

export interface LocalChanges {
  readonly tours: ReadonlyMap<string, TourChanges>;
  readonly hiddenTourIds: ReadonlySet<string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const seatList = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.filter((seat): seat is number => Number.isInteger(seat) && seat > 0)
    : [];

function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Reads, without the panel's full checks, the few things public pages take
 * from the panel's records on this device: prices, sold seats and hidden
 * tours. Whatever does not have the expected shape is ignored; the values
 * only ever reach the page as text and attributes.
 */
export function readLocalChanges(storage: SafeStorage): LocalChanges {
  const tours = new Map<string, TourChanges>();
  const drafts = parse(storage.read(TOUR_DRAFTS_KEY));
  if (isRecord(drafts)) {
    for (const [tourId, entry] of Object.entries(drafts)) {
      const tour = isRecord(entry) ? entry['tour'] : null;
      if (!isRecord(tour)) continue;
      const departures = new Map<string, number[]>();
      if (Array.isArray(tour['departures'])) {
        for (const departure of tour['departures']) {
          if (isRecord(departure) && typeof departure['id'] === 'string') {
            departures.set(departure['id'], seatList(departure['bookedSeats']));
          }
        }
      }
      const price = tour['pricePerPersonTry'];
      const layout = tour['seatLayout'];
      tours.set(tourId, {
        priceTry: typeof price === 'number' && Number.isInteger(price) && price > 0 ? price : null,
        seatLayout: layout === '2+1' || layout === '2+2' ? layout : null,
        departures,
      });
    }
  }
  const settings = parse(storage.read(SITE_SETTINGS_KEY));
  const hidden =
    isRecord(settings) && Array.isArray(settings['hiddenTourIds'])
      ? settings['hiddenTourIds'].filter((id): id is string => typeof id === 'string')
      : [];
  return { tours, hiddenTourIds: new Set(hidden) };
}
