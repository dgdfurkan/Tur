import { describe, expect, it } from 'vitest';
import { Money } from '@/domain/shared/Money';
import { Departure } from '@/domain/tour/Departure';
import { RoutePlan } from '@/domain/tour/RoutePlan';
import { Tour } from '@/domain/tour/Tour';
import { SeatLayout } from '@/domain/vehicle/SeatLayout';
import { filmCopy, type FilmBranding } from '@/features/film/FilmCopy';
import { filmTour } from './fixtures';

const branding: FilmBranding = {
  brandName: '  Örnek Ajans ',
  contactLine: ' 0312 000 00 00 ',
  showDate: true,
  showPrice: true,
};

/** The film tour with one departure that still has seats. */
function tourWithDeparture(): Tour {
  const base = filmTour();
  return new Tour({
    ...base,
    price: Money.fromLira(9850),
    departures: [
      new Departure({
        id: 'd1',
        tourId: base.id,
        startDate: '2026-11-06',
        endDate: '2026-11-07',
        time: '07:00',
        meetingPoint: 'Kızılay, Güvenpark önü',
        layout: SeatLayout.of('2+1'),
        bookedSeats: [1, 2, 3],
      }),
    ],
  });
}

describe('filmCopy', () => {
  it('gathers the words of a film about the whole tour', () => {
    const tour = tourWithDeparture();
    const copy = filmCopy(tour, RoutePlan.fromTour(tour), 'journey', branding, '2026-10-01');
    expect(copy).toMatchObject({
      brandName: 'Örnek Ajans',
      contactLine: '0312 000 00 00',
      title: 'Film Turu',
      subtitle: '1 Gece 2 Gün',
      details: ['6-7 Kasım 2026', 'Kişi Başı ₺9.850'],
    });
    expect(copy.chips[0]).toBe('5 Gezi Noktası');
    expect(copy.chips[1]).toMatch(/^Yaklaşık [\d.]+ km$/);
    expect(copy.pass).toMatchObject({
      tourTitle: 'Film Turu',
      date: '6 Kasım 2026 Cuma',
      time: '07.00',
      meetingPoint: 'Kızılay, Güvenpark önü',
      seat: '4',
      destination: 'Hedef',
    });
  });

  it('names the day and counts only its sights in a film of one day', () => {
    const tour = tourWithDeparture();
    const copy = filmCopy(tour, RoutePlan.forDay(tour, 2), 'day', branding, '2026-10-01', 2);
    expect(copy.title).toBe('İkinci Gün');
    expect(copy.subtitle).toBe('Film Turu, 2. Gün');
    expect(copy.chips[0]).toBe('3 Gezi Noktası');
  });

  it('leaves out what was not asked for or is not known', () => {
    const tour = filmTour();
    const quiet = { brandName: '', contactLine: '', showDate: true, showPrice: false };
    const copy = filmCopy(tour, RoutePlan.fromTour(tour), 'journey', quiet, '2026-10-01');
    // The tour has no departure, so there is no date to show and the pass starts at the first stop.
    expect(copy.details).toEqual([]);
    expect(copy.pass).toMatchObject({ date: '', time: '', seat: '–', meetingPoint: 'ankara' });
  });
});
