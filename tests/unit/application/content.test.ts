import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TourCatalogService } from '@/application/TourCatalogService';
import { toTour } from '@/application/tourMapper';
import type { TourData } from '@/application/dto/TourData';
import type { Tour } from '@/domain/tour/Tour';

const CONTENT_DIR = join(process.cwd(), 'src/content/tours');

const tours: Tour[] = readdirSync(CONTENT_DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => {
    const data = JSON.parse(readFileSync(join(CONTENT_DIR, file), 'utf8')) as TourData;
    return toTour({ id: file.replace(/\.json$/, ''), ...data });
  });

const daysBetween = (start: string, end: string): number =>
  (Date.parse(end) - Date.parse(start)) / 86_400_000;

describe('tour content', () => {
  it('contains the sample tours', () => {
    expect(tours.length).toBeGreaterThanOrEqual(5);
  });

  it.each(tours.map((tour) => [tour.id, tour] as const))(
    '%s is internally consistent',
    (_id, tour) => {
      const stops = tour.stops;
      expect(stops[0]?.kind).toBe('departure');
      expect(stops.at(-1)?.kind).toBe('arrival');
      expect(new Set(stops.map((stop) => stop.id)).size).toBe(stops.length);

      expect(tour.dayCount).toBe(tour.nights + 1);
      expect(tour.hotels.reduce((sum, hotel) => sum + hotel.nights, 0)).toBe(tour.nights);
      if (tour.isDayTrip) {
        expect(tour.singleSupplement).toBeNull();
      } else {
        expect(tour.singleSupplement).not.toBeNull();
      }

      for (const departure of tour.departures) {
        expect(daysBetween(departure.startDate, departure.endDate)).toBe(tour.nights);
      }
      expect(new Set(tour.departures.map((d) => d.id)).size).toBe(tour.departures.length);
      expect(tour.routeDistanceKm).toBeGreaterThan(tour.distanceFromOriginKm);
    },
  );
});

describe('TourCatalogService', () => {
  const service = new TourCatalogService({ findAll: async () => tours });

  it('lists tours by distance from Ankara', async () => {
    const distances = (await service.listTours()).map((tour) => tour.distanceFromOriginKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('lists upcoming departures soonest first and honours the limit', async () => {
    const upcoming = await service.upcomingDepartures('2026-11-10', 3);
    expect(upcoming).toHaveLength(3);
    const dates = upcoming.map((item) => item.departure.startDate);
    expect(dates).toEqual([...dates].sort());
    expect(dates.every((date) => date >= '2026-11-10')).toBe(true);
  });

  it('lists each tour once with its next departure', async () => {
    const next = await service.nextDepartures('2026-11-10');
    const ids = next.map((item) => item.tour.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { tour, departure } of next) {
      expect(departure).toBe(tour.nextDeparture('2026-11-10'));
    }
    expect(await service.nextDepartures('2026-11-10', 2)).toHaveLength(2);
    expect(await service.nextDepartures('2030-01-01')).toEqual([]);
  });
});
