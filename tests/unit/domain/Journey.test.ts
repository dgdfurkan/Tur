import { describe, expect, it } from 'vitest';
import { byLatest, Journey, totalsOf, type JourneyProps } from '@/domain/journey/Journey';

const props: JourneyProps = {
  id: '2026-09-18-kapadokya',
  tourId: 'kapadokya',
  title: 'Kapadokya Kültür Turu',
  scene: 'uc-guzeller',
  startDate: '2026-09-18',
  endDate: '2026-09-20',
  group: 'genel',
  guests: 41,
  distanceKm: 850,
  story: 'Üç günlük program tamamlandı.',
  moments: [
    { day: 3, place: 'Mustafapaşa', scene: 'tas-konak', note: '' },
    { day: 1, place: 'Ihlara Vadisi', scene: 'vadi', note: 'Yürüyüş yapıldı.' },
    { day: 1, place: 'Derinkuyu', scene: 'yeralti', note: '' },
  ],
};

describe('Journey', () => {
  it('counts its days and nights from its dates', () => {
    const journey = new Journey(props);
    expect(journey.dayCount).toBe(3);
    expect(journey.nights).toBe(2);
    expect(journey.year).toBe(2026);
    expect(new Journey({ ...props, endDate: props.startDate, moments: [] }).dayCount).toBe(1);
  });

  it('knows the date of each of its days, across the end of a month', () => {
    const journey = new Journey({ ...props, startDate: '2026-10-30', endDate: '2026-11-01' });
    expect(journey.dateOfDay(1)).toBe('2026-10-30');
    expect(journey.dateOfDay(3)).toBe('2026-11-01');
  });

  it('lists moments by day, keeping the given order within a day', () => {
    expect(new Journey(props).moments.map((moment) => moment.place)).toEqual([
      'Ihlara Vadisi',
      'Derinkuyu',
      'Mustafapaşa',
    ]);
  });

  it('refuses what cannot have happened', () => {
    expect(() => new Journey({ ...props, endDate: '2026-09-17' })).toThrow(RangeError);
    expect(() => new Journey({ ...props, guests: 0 })).toThrow(RangeError);
    expect(() => new Journey({ ...props, distanceKm: 0 })).toThrow(RangeError);
    expect(
      () =>
        new Journey({
          ...props,
          moments: [{ day: 4, place: 'Ankara', scene: 'sehir', note: '' }],
        }),
    ).toThrow(RangeError);
  });

  it('adds journeys up and orders them latest first', () => {
    const earlier = new Journey({
      ...props,
      id: 'earlier',
      startDate: '2026-05-22',
      endDate: '2026-05-24',
      guests: 30,
    });
    const later = new Journey(props);
    expect(totalsOf([earlier, later])).toEqual({ count: 2, guests: 71, distanceKm: 1700 });
    expect([earlier, later].sort(byLatest).map((journey) => journey.id)).toEqual([
      later.id,
      'earlier',
    ]);
  });
});
