import { GeoPoint } from '@/domain/geo/GeoPoint';
import { Money } from '@/domain/shared/Money';
import { RoutePlan } from '@/domain/tour/RoutePlan';
import { Tour, type Stop, type StopKind } from '@/domain/tour/Tour';

export function stop(
  id: string,
  kind: StopKind,
  lat: number,
  lon: number,
  extra: Partial<Stop> = {},
): Stop {
  return {
    id,
    name: id,
    kind,
    location: new GeoPoint(lat, lon),
    summary: `${id} summary`,
    scene: 'sehir',
    facts: [],
    ...extra,
  };
}

/** Two days: Ankara, a rest stop, two sights and a hotel, then three sights and the way home. */
export function filmTour(): Tour {
  return new Tour({
    id: 'film',
    title: 'Film Turu',
    category: 'kultur',
    summary: '',
    emblem: 'konak',
    scene: 'konak',
    destination: 'Hedef',
    nights: 1,
    distanceFromOriginKm: 300,
    price: Money.fromLira(5000),
    singleSupplement: null,
    included: [],
    excluded: [],
    hotels: [],
    days: [
      {
        number: 1,
        title: 'İlk Gün',
        summary: '',
        stops: [
          stop('ankara', 'departure', 39.92, 32.85),
          stop('mola', 'rest', 39.2, 33.3, { durationMinutes: 20 }),
          stop('kale', 'sight', 38.7, 34.0, {
            durationMinutes: 60,
            facts: [{ label: 'Yapım', value: '1229' }],
          }),
          stop('vadi', 'sight', 38.6, 34.4, { durationMinutes: 90 }),
          stop('otel', 'lodging', 38.63, 34.9),
        ],
      },
      {
        number: 2,
        title: 'İkinci Gün',
        summary: '',
        stops: [
          stop('muze', 'sight', 38.64, 34.85, {
            durationMinutes: 120,
            facts: [
              { label: 'UNESCO', value: '1985' },
              { label: 'Dönem', value: '10. yüzyıl' },
            ],
          }),
          stop('koy', 'sight', 38.59, 34.9, { durationMinutes: 45 }),
          stop('carsi', 'sight', 38.72, 34.85, {
            durationMinutes: 60,
            facts: [{ label: 'Zanaat', value: 'Çömlek' }],
          }),
          stop('donus', 'arrival', 39.92, 32.85),
        ],
      },
    ],
    departures: [],
  });
}

export function filmPlan(): RoutePlan {
  return RoutePlan.fromTour(filmTour());
}
