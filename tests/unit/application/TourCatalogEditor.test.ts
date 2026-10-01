import { describe, expect, it } from 'vitest';
import {
  checkTour,
  fingerprint,
  InvalidTourError,
  TourCatalogEditor,
} from '@/application/TourCatalogEditor';
import {
  addDays,
  newDepartureId,
  removeDeparture,
  saveDeparture,
  setDetails,
  setPrice,
  setSingleSupplement,
  setStop,
} from '@/application/tourEdits';
import { TOUR_DRAFTS_KEY } from '@/infrastructure/storage/keys';
import { LocalTourDrafts } from '@/infrastructure/storage/LocalTourDrafts';
import { memoryStorage, publishedTours } from '../support/stores';

function editor(storage = memoryStorage()) {
  const drafts = new LocalTourDrafts(storage);
  return {
    storage,
    drafts,
    catalog: new TourCatalogEditor(
      publishedTours(),
      drafts,
      () => new Date('2026-10-01T09:00:00Z'),
    ),
  };
}

describe('TourCatalogEditor', () => {
  it('shows the published tours until something changes', () => {
    const { catalog } = editor();
    expect(catalog.tours().map((tour) => tour.id)).toEqual(publishedTours().map((tour) => tour.id));
    expect(catalog.isChanged('kapadokya')).toBe(false);
  });

  it('keeps a change, and forgets it once the tour is back as published', () => {
    const { catalog } = editor();
    const before = catalog.tour('kapadokya')?.price.lira ?? 0;

    expect(catalog.change('kapadokya', setPrice(10_500)).price.lira).toBe(10_500);
    expect(catalog.tour('kapadokya')?.price.lira).toBe(10_500);
    expect(catalog.isChanged('kapadokya')).toBe(true);

    catalog.change('kapadokya', setPrice(before));
    expect(catalog.isChanged('kapadokya')).toBe(false);
  });

  it('refuses a change that breaks the rules and stores nothing', () => {
    const { catalog, storage } = editor();
    expect(() => catalog.change('kapadokya', setPrice(-5))).toThrow(InvalidTourError);
    expect(() => catalog.change('kapadokya', setDetails({ title: '' }))).toThrow(InvalidTourError);
    // A coach of the other layout has fewer seats than some already sold.
    expect(() =>
      catalog.change(
        'kapadokya',
        saveDeparture({
          id: 'x',
          startDate: '2026-12-01',
          endDate: '2026-12-03',
          time: '07:00',
          meetingPoint: 'Kızılay',
          bookedSeats: [99],
        }),
      ),
    ).toThrow(InvalidTourError);
    expect(storage.read(TOUR_DRAFTS_KEY)).toBeNull();
  });

  it('adds, changes and removes departures in date order', () => {
    const { catalog } = editor();
    const tour = catalog.snapshot('beypazari-gunubirlik');
    if (!tour) throw new Error('missing tour');
    const id = newDepartureId(tour, '2027-01-09');
    catalog.change(
      tour.id,
      saveDeparture({
        id,
        startDate: '2027-01-09',
        endDate: addDays('2027-01-09', 0),
        time: '08:00',
        meetingPoint: 'Kızılay',
        bookedSeats: [1, 2],
      }),
    );
    const dates = catalog.snapshot(tour.id)?.departures.map((departure) => departure.startDate);
    expect(dates).toEqual([...(dates ?? [])].sort());
    expect(catalog.tour(tour.id)?.findDeparture(id)?.occupancy.booked).toBe(2);

    catalog.change(tour.id, removeDeparture(id));
    expect(catalog.tour(tour.id)?.findDeparture(id)).toBeUndefined();
    expect(catalog.isChanged(tour.id)).toBe(false);
  });

  it('changes what is told about a stop and leaves an emptied duration out', () => {
    const { catalog } = editor();
    catalog.change(
      'kapadokya',
      setStop(0, 1, { summary: 'Yeni açıklama.', durationMinutes: undefined }),
    );
    const stop = catalog.snapshot('kapadokya')?.days[0]?.stops[1];
    expect(stop?.summary).toBe('Yeni açıklama.');
    expect(stop && 'durationMinutes' in stop).toBe(false);
  });

  it('removes and restores the single supplement', () => {
    const { catalog } = editor();
    catalog.change('kapadokya', setSingleSupplement(null));
    expect(catalog.tour('kapadokya')?.singleSupplement).toBeNull();
    catalog.change('kapadokya', setSingleSupplement(3500));
    expect(catalog.tour('kapadokya')?.singleSupplement?.lira).toBe(3500);
  });

  it('notices when the site published a newer tour than the change began from', () => {
    const storage = memoryStorage();
    const { catalog } = editor(storage);
    catalog.change('kapadokya', setPrice(10_500));
    expect(catalog.isStale('kapadokya')).toBe(false);

    const newer = publishedTours().map((tour) =>
      tour.id === 'kapadokya' ? { ...tour, summary: `${tour.summary} Güncel.` } : tour,
    );
    const later = new TourCatalogEditor(newer, new LocalTourDrafts(storage), () => new Date());
    expect(later.isStale('kapadokya')).toBe(true);
    later.discard('kapadokya');
    expect(later.tour('kapadokya')?.summary).toContain('Güncel.');
  });

  it('drops stored drafts that are damaged or break the rules', () => {
    const storage = memoryStorage();
    const valid = publishedTours()[0];
    if (!valid) throw new Error('no tours');
    storage.write(
      TOUR_DRAFTS_KEY,
      JSON.stringify({
        [valid.id]: {
          base: fingerprint(valid),
          updatedAt: 'x',
          tour: { ...valid, pricePerPersonTry: 1 },
        },
        broken: { base: 'a', updatedAt: 'b', tour: { id: 'broken' } },
        wrongKey: { base: 'a', updatedAt: 'b', tour: valid },
      }),
    );
    expect(Object.keys(new LocalTourDrafts(storage).load())).toEqual([valid.id]);
    storage.write(TOUR_DRAFTS_KEY, '{not json');
    expect(new LocalTourDrafts(storage).load()).toEqual({});
  });

  it('accepts every published tour as it is', () => {
    for (const tour of publishedTours()) expect(() => checkTour(tour)).not.toThrow();
  });
});
