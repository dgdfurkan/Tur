import { describe, expect, it, vi } from 'vitest';
import { GeoPoint } from '@/domain/geo/GeoPoint';
import { Money } from '@/domain/shared/Money';
import { RoutePlan } from '@/domain/tour/RoutePlan';
import { Tour, type Stop, type StopKind } from '@/domain/tour/Tour';
import { easeLeg, RouteSimulation } from '@/features/route-simulation/RouteSimulation';

function stop(id: string, kind: StopKind, lat: number, lon: number): Stop {
  return { id, name: id, kind, location: new GeoPoint(lat, lon), summary: id };
}

function plan(): RoutePlan {
  const tour = new Tour({
    id: 't',
    title: 'T',
    category: 'kultur',
    summary: 's',
    emblem: 'konak',
    destination: 'D',
    nights: 1,
    distanceFromOriginKm: 100,
    price: Money.fromLira(1),
    singleSupplement: null,
    included: [],
    excluded: [],
    hotels: [],
    days: [
      {
        number: 1,
        title: 'd1',
        summary: '',
        stops: [stop('a', 'departure', 39.9, 32.8), stop('b', 'sight', 39.0, 33.5)],
      },
      {
        number: 2,
        title: 'd2',
        summary: '',
        stops: [stop('c', 'rest', 38.5, 34.0), stop('d', 'arrival', 39.9, 32.8)],
      },
    ],
    departures: [],
  });
  return RoutePlan.fromTour(tour);
}

describe('RoutePlan', () => {
  it('lays stops out in travel order with cumulative distance and day', () => {
    const route = plan();
    expect(route.stops.map((s) => s.stop.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(route.stops.map((s) => s.day)).toEqual([1, 1, 2, 2]);
    expect(route.stops[0]?.distanceKm).toBe(0);
    expect(route.legKm(0)).toBeGreaterThan(100);
    expect(route.totalKm).toBeCloseTo(route.legKm(0) + route.legKm(1) + route.legKm(2));
    expect(route.legCount).toBe(3);
  });

  it('reports the bounding box of its stops', () => {
    const { minX, maxX, minY, maxY } = plan().bounds;
    expect(minX).toBeLessThan(maxX);
    expect(minY).toBeLessThan(maxY);
  });

  it('measures the room around a stop, ignoring stops at the same place', () => {
    const route = plan();
    // The first and last stops share a location, so the nearest neighbour is the second stop.
    expect(route.clearanceKm(0)).toBeCloseTo(route.legKm(0), 0);
    expect(route.clearanceKm(3)).toBeCloseTo(route.clearanceKm(0));
    expect(route.clearanceKm(2)).toBeCloseTo(route.legKm(1), 0);
    expect(route.clearanceKm(99)).toBe(Infinity);
  });
});

describe('RouteSimulation', () => {
  it('stays idle until played', () => {
    const simulation = new RouteSimulation(plan());
    simulation.update(10);
    expect(simulation.snapshot).toMatchObject({ phase: 'idle', legProgress: 0 });
  });

  it('drives, dwells at stops and finishes at the last stop', () => {
    const simulation = new RouteSimulation(plan());
    const reached = vi.fn();
    const departed = vi.fn();
    const finished = vi.fn();
    simulation.subscribe({ stopReached: reached, departed, finished });

    simulation.play();
    expect(departed).toHaveBeenCalledWith(0);

    simulation.update(simulation.legSeconds(0) / 2);
    expect(simulation.snapshot).toMatchObject({ phase: 'driving', legIndex: 0 });
    expect(simulation.snapshot.legProgress).toBeCloseTo(0.5);

    simulation.update(simulation.legSeconds(0));
    expect(reached).toHaveBeenLastCalledWith(1);
    expect(simulation.snapshot).toMatchObject({ phase: 'dwelling', legIndex: 1, stopIndex: 1 });

    simulation.update(1000);
    expect(reached.mock.calls.map(([index]) => index)).toEqual([1, 2, 3]);
    expect(finished).toHaveBeenCalledOnce();
    expect(simulation.snapshot).toMatchObject({ phase: 'finished', playing: false, stopIndex: 3 });
  });

  it('does not advance while paused and honours speed', () => {
    const simulation = new RouteSimulation(plan());
    simulation.play();
    simulation.pause();
    simulation.update(5);
    expect(simulation.snapshot.legProgress).toBe(0);

    simulation.setSpeed(2);
    simulation.play();
    simulation.update(simulation.legSeconds(0) / 4);
    expect(simulation.snapshot.legProgress).toBeCloseTo(0.5);
  });

  it('seeks to a stop and restarts', () => {
    const simulation = new RouteSimulation(plan());
    simulation.seekToStop(2);
    expect(simulation.snapshot).toMatchObject({ phase: 'dwelling', legIndex: 2, stopIndex: 2 });

    simulation.seekToStop(3);
    expect(simulation.snapshot).toMatchObject({ phase: 'finished', stopIndex: 3, legProgress: 1 });

    simulation.restart();
    expect(simulation.snapshot).toMatchObject({ phase: 'idle', legIndex: 0, playing: false });
    expect(() => simulation.seekToStop(9)).toThrow(RangeError);
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const simulation = new RouteSimulation(plan());
    const changed = vi.fn();
    const unsubscribe = simulation.subscribe({ changed });
    simulation.play();
    unsubscribe();
    simulation.pause();
    expect(changed).toHaveBeenCalledOnce();
  });
});

describe('easeLeg', () => {
  it('eases in and out between fixed end points', () => {
    expect(easeLeg(0)).toBe(0);
    expect(easeLeg(1)).toBe(1);
    expect(easeLeg(0.5)).toBeCloseTo(0.5);
    expect(easeLeg(0.25)).toBeLessThan(0.25);
    expect(easeLeg(2)).toBe(1);
  });
});
