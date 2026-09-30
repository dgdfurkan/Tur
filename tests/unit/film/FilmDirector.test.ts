import { describe, expect, it } from 'vitest';
import type { RoutePlan } from '@/domain/tour/RoutePlan';
import { FilmDirector } from '@/features/film/FilmDirector';
import { layoutFor } from '@/features/film/FilmLayout';
import { overlayAt, PASS_TIMING, soundCues } from '@/features/film/FilmOverlay';
import { FILM_FORMATS } from '@/features/film/formats';
import { Storyboard } from '@/features/film/Storyboard';
import { easeLeg } from '@/features/route-simulation/RouteSimulation';
import type { OverviewOptions, RouteView } from '@/features/route-simulation/RouteView';
import { filmPlan } from './fixtures';

/** A map that only writes down what it is told. */
class RecordingStage implements RouteView {
  readonly calls: string[] = [];
  position: [number, number] = [0, 0];

  showRoute(plan: RoutePlan): void {
    this.calls.push(`route:${plan.stops.length}`);
  }
  setPosition(legIndex: number, legProgress: number): void {
    this.position = [legIndex, legProgress];
  }
  showOverview(options: OverviewOptions = {}): void {
    this.calls.push(`overview:${options.road ?? 'whole'}:${options.immediate ? 'now' : 'glide'}`);
  }
  followCoach(legIndex: number): void {
    this.calls.push(`follow:${legIndex}`);
  }
  focusStop(stopIndex: number): void {
    this.calls.push(`focus:${stopIndex}`);
  }
  setActiveStop(stopIndex: number | null): void {
    this.calls.push(`active:${stopIndex}`);
  }
  setVisitedThrough(stopIndex: number): void {
    this.calls.push(`visited:${stopIndex}`);
  }
  setTimeOfDay(time: string): void {
    this.calls.push(`time:${time}`);
  }
  setPadding(): void {
    this.calls.push('padding');
  }
  onFrame(): void {
    // A film steps the map itself.
  }
  start(): void {
    this.calls.push('start');
  }
  dispose(): void {
    this.calls.push('dispose');
  }
}

const reels = FILM_FORMATS.find((format) => format.id === 'reels');
if (!reels) throw new Error('The Reels format is missing');
const framing = layoutFor(reels).framing;

function shotStart(board: Storyboard, kind: string, nth = 0): number {
  const shot = board.shots.filter((candidate) => candidate.kind === kind)[nth];
  if (!shot) throw new Error(`No ${kind} shot number ${nth}`);
  return shot.start;
}

describe('FilmDirector', () => {
  it('opens on the whole route and never starts a frame loop', () => {
    const plan = filmPlan();
    const stage = new RecordingStage();
    const director = new FilmDirector(plan, new Storyboard(plan, 'journey'), stage, framing);
    director.direct(0);
    expect(stage.calls).toContain('route:9');
    expect(stage.calls).toContain('overview:whole:now');
    expect(stage.calls).not.toContain('start');
  });

  it('sets each shot up once and moves the coach on every frame', () => {
    const plan = filmPlan();
    const board = new Storyboard(plan, 'journey');
    const stage = new RecordingStage();
    const director = new FilmDirector(plan, board, stage, framing);

    const drive = board.shots.find((shot) => shot.kind === 'drive');
    if (!drive) throw new Error('No drive shot');
    director.direct(drive.start);
    director.direct(drive.start + drive.seconds / 2);
    expect(stage.calls.filter((call) => call === 'follow:0')).toHaveLength(1);
    expect(stage.position[0]).toBe(0);
    expect(stage.position[1]).toBeCloseTo(0.5);
  });

  it('lets evening fall at a hotel and brings the day back on the road', () => {
    const plan = filmPlan();
    const board = new Storyboard(plan, 'journey');
    const stage = new RecordingStage();
    const director = new FilmDirector(plan, board, stage, framing);

    const hotel = board.shots.find((shot) => shot.kind === 'stop' && shot.stopIndex === 4);
    if (!hotel) throw new Error('No hotel shot');
    director.direct(hotel.start);
    expect(stage.calls.slice(-5)).toEqual([
      'visited:3',
      'active:4',
      'time:dusk',
      'padding',
      'focus:4',
    ]);

    director.direct(hotel.start + hotel.seconds);
    expect(stage.calls).toContain('follow:4');
    expect(stage.calls.at(-3)).toBe('time:day');
  });

  it('draws the road behind the coach at a steady pace in an outline', () => {
    const plan = filmPlan();
    const board = new Storyboard(plan, 'outline');
    const stage = new RecordingStage();
    const director = new FilmDirector(plan, board, stage, framing);
    const trace = board.shots[1];
    if (!trace) throw new Error('No trace shot');

    director.direct(0);
    director.direct(trace.start);
    expect(stage.calls).toContain('overview:travelled:glide');

    // Half-way through the shot the coach is half-way along the route.
    director.direct(trace.start + trace.seconds / 2);
    const [leg, progress] = stage.position;
    const from = plan.stops[leg]?.distanceKm ?? 0;
    expect(from + easeLeg(progress) * plan.legKm(leg)).toBeCloseTo(plan.totalKm / 2, 0);

    director.direct(trace.start + trace.seconds - 0.0001);
    expect(stage.position[0]).toBe(plan.legCount - 1);
    expect(easeLeg(stage.position[1])).toBeCloseTo(1, 2);
  });

  it('can be rewound to show any moment again', () => {
    const plan = filmPlan();
    const board = new Storyboard(plan, 'journey');
    const stage = new RecordingStage();
    const director = new FilmDirector(plan, board, stage, framing);
    director.direct(shotStart(board, 'outro'));
    director.rewind();
    stage.calls.length = 0;
    director.direct(0);
    expect(stage.calls).toContain('overview:whole:now');
  });
});

describe('overlayAt', () => {
  const plan = filmPlan();
  const board = new Storyboard(plan, 'journey');

  it('brings the title sign in and takes it away before the next shot', () => {
    const title = board.shots[0];
    if (!title) throw new Error('No title');
    expect(overlayAt(board.at(0), plan).title).toBe(0);
    expect(overlayAt(board.at(title.seconds / 2), plan).title).toBe(1);
    expect(overlayAt(board.at(title.seconds - 0.01), plan).title).toBeLessThan(0.1);
  });

  it('names the next stop while driving and shows the place at a stop', () => {
    const driving = overlayAt(board.at(shotStart(board, 'drive') + 0.5), plan);
    expect(driving.heading?.stop.stop.id).toBe('mola');
    expect(driving.heading?.km).toBeCloseTo(plan.legKm(0));
    expect(driving.place).toBeNull();
    expect(driving.day).toBe(1);

    const stopped = overlayAt(board.at(shotStart(board, 'stop', 4) + 1), plan);
    expect(stopped.place?.stop.stop.id).toBe('muze');
    expect(stopped.place?.shown).toBe(1);
    expect(stopped.heading).toBeNull();
    expect(stopped.day).toBe(2);
  });

  it('hands the screen to the boarding pass, then to the closing sign', () => {
    const boarding = overlayAt(board.at(shotStart(board, 'boarding') + 1), plan);
    expect(boarding.pass).toBeCloseTo(1);
    const outro = overlayAt(board.at(board.seconds), plan);
    expect(outro).toMatchObject({ outro: 1, brand: 0, pass: null, place: null });
  });
});

describe('soundCues', () => {
  it('stamps and punches the pass, revs on the road and chimes at stops, in order', () => {
    const plan = filmPlan();
    const board = new Storyboard(plan, 'journey');
    const cues = soundCues(board);
    const times = cues.map((cue) => cue.time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);

    const boarding = shotStart(board, 'boarding');
    expect(cues.find((cue) => cue.kind === 'stamp')?.time).toBeCloseTo(
      boarding + PASS_TIMING.stampAt,
    );
    expect(cues.find((cue) => cue.kind === 'punch')?.time).toBeCloseTo(
      boarding + PASS_TIMING.punchAt,
    );
    expect(cues.filter((cue) => cue.kind === 'chime')).toHaveLength(8);
    expect(cues.at(-2)).toMatchObject({ kind: 'engine', level: 0 });
  });
});
