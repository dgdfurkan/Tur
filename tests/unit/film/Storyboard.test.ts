import { describe, expect, it } from 'vitest';
import { RoutePlan } from '@/domain/tour/RoutePlan';
import { pickHighlights, Storyboard } from '@/features/film/Storyboard';
import { filmPlan, filmTour } from './fixtures';

const kinds = (board: Storyboard): string[] => board.shots.map((shot) => shot.kind);

describe('Storyboard', () => {
  it('tells the whole journey: title, boarding pass, every leg and stop, then the closing sign', () => {
    const plan = filmPlan();
    const board = new Storyboard(plan, 'journey');
    expect(kinds(board).slice(0, 2)).toEqual(['title', 'boarding']);
    expect(kinds(board).at(-1)).toBe('outro');
    expect(board.shots.filter((shot) => shot.kind === 'drive')).toHaveLength(plan.legCount);
    // Every stop on the way is visited; the departure and the arrival are not stopped at.
    const stops = board.shots.flatMap((shot) => (shot.kind === 'stop' ? [shot.stopIndex] : []));
    expect(stops).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('runs its shots back to back', () => {
    const board = new Storyboard(filmPlan(), 'journey');
    let clock = 0;
    for (const shot of board.shots) {
      expect(shot.start).toBeCloseTo(clock);
      expect(shot.seconds).toBeGreaterThan(0);
      clock += shot.seconds;
    }
    expect(board.seconds).toBeCloseTo(clock);
    expect(board.frameCount(30)).toBe(Math.ceil(clock * 30));
  });

  it('leaves the boarding pass out of a single day', () => {
    const board = new Storyboard(RoutePlan.forDay(filmTour(), 2), 'day');
    expect(kinds(board)).not.toContain('boarding');
    expect(kinds(board)[0]).toBe('title');
    expect(kinds(board)[1]).toBe('drive');
  });

  it('shows at most four sights in a short film, those with most to say, in travel order', () => {
    const plan = filmPlan();
    const picked = pickHighlights(plan).map((stop) => stop.stop.id);
    expect(picked).toEqual(['kale', 'vadi', 'muze', 'carsi']);
    expect(pickHighlights(plan, 2).map((stop) => stop.stop.id)).toEqual(['kale', 'muze']);

    const board = new Storyboard(plan, 'highlights');
    expect(kinds(board)).toEqual(['title', 'stop', 'stop', 'stop', 'stop', 'outro']);
  });

  it('traces the road in one steady shot for an outline', () => {
    const board = new Storyboard(filmPlan(), 'outline');
    expect(kinds(board)).toEqual(['title', 'trace', 'outro']);
    const trace = board.shots[1];
    expect(trace?.seconds).toBeGreaterThanOrEqual(5);
    expect(trace?.seconds).toBeLessThanOrEqual(9);
  });

  it('finds the shot on screen at any time', () => {
    const board = new Storyboard(filmPlan(), 'journey');
    expect(board.at(0)).toMatchObject({ index: 0, local: 0, progress: 0 });
    expect(board.at(-5).index).toBe(0);

    const second = board.shots[1];
    const middle = board.at((second?.start ?? 0) + (second?.seconds ?? 0) / 2);
    expect(middle.index).toBe(1);
    expect(middle.progress).toBeCloseTo(0.5);

    const end = board.at(board.seconds + 10);
    expect(end.index).toBe(board.shots.length - 1);
    expect(end.progress).toBe(1);
  });

  it('refuses a route with nowhere to go', () => {
    const lonely = RoutePlan.fromStops(
      filmPlan()
        .stops.slice(0, 1)
        .map((s) => ({ stop: s.stop, day: 1 })),
    );
    expect(() => new Storyboard(lonely, 'journey')).toThrow(RangeError);
  });
});
