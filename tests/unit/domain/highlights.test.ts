import { describe, expect, it } from 'vitest';
import { GeoPoint } from '@/domain/geo/GeoPoint';
import { Money } from '@/domain/shared/Money';
import { rankSights } from '@/domain/tour/highlights';
import { Tour, type SceneKey, type Stop, type StopKind } from '@/domain/tour/Tour';

function stop(
  id: string,
  kind: StopKind,
  scene: SceneKey,
  facts = 0,
  durationMinutes?: number,
): Stop {
  return {
    id,
    name: id,
    kind,
    location: new GeoPoint(39, 33),
    summary: '',
    scene,
    facts: Array.from({ length: facts }, (_, index) => ({ label: `L${index}`, value: 'V' })),
    ...(durationMinutes === undefined ? {} : { durationMinutes }),
  };
}

const stops = [
  stop('ankara', 'departure', 'sehir'),
  stop('mola', 'rest', 'mola', 2, 20),
  stop('han', 'sight', 'kervansaray', 1, 45),
  stop('vadi', 'sight', 'vadi', 2, 150),
  stop('bacalar', 'sight', 'uc-guzeller', 2, 30),
  stop('muze', 'sight', 'kaya-kilise', 2, 120),
  stop('vadi', 'sight', 'vadi', 2, 150),
  stop('seyir', 'sight', 'vadi', 2, 200),
  stop('donus', 'arrival', 'sehir'),
];

function tour(): Tour {
  return new Tour({
    id: 't',
    title: 'Tur',
    category: 'kultur',
    summary: '',
    emblem: 'peribacasi',
    scene: 'uc-guzeller',
    destination: 'Hedef',
    nights: 0,
    distanceFromOriginKm: 300,
    price: Money.fromLira(1000),
    singleSupplement: null,
    included: [],
    excluded: [],
    hotels: [],
    days: [{ number: 1, title: '', summary: '', stops }],
    departures: [],
  });
}

describe('rankSights', () => {
  it('puts the sights with most to say first and counts a place once', () => {
    expect(rankSights(stops).map((sight) => sight.id)).toEqual([
      'seyir',
      'vadi',
      'muze',
      'bacalar',
      'han',
    ]);
  });
});

describe('Tour.highlights', () => {
  it('shows each picture once, never the tour’s own, in travel order', () => {
    expect(
      tour()
        .highlights(3)
        .map((sight) => sight.id),
    ).toEqual(['han', 'muze', 'seyir']);
    expect(
      tour()
        .highlights(1)
        .map((sight) => sight.id),
    ).toEqual(['seyir']);
  });
});
