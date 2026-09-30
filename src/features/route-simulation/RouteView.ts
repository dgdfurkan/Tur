import type { RoutePlan } from '@/domain/tour/RoutePlan';
import type { Disposable, ViewPadding } from '@/shared/lifecycle';
import type { TimeOfDay } from '@/shared/timeOfDay';

export interface OverviewOptions {
  /** Jump straight to the view instead of gliding there. */
  readonly immediate?: boolean;
  /** How much of the road is drawn: all of it (the default), or only as far as the coach has come. */
  readonly road?: 'whole' | 'travelled';
}

/**
 * What the simulation needs from a map, whatever draws it. The 3D scene and the
 * flat SVG fallback both implement this, so the controller never knows which
 * one it is driving.
 */
export interface RouteView extends Disposable {
  /** Draws the route and parks the coach at the first stop. */
  showRoute(plan: RoutePlan): void;
  /** Places the coach part-way along the leg that starts at `legIndex`. */
  setPosition(legIndex: number, legProgress: number): void;
  /** Frames the whole route; by default all of its road is drawn, as on a printed map. */
  showOverview(options?: OverviewOptions): void;
  /** Keeps the coach in view while it travels along a leg; only the road behind it stays drawn. */
  followCoach(legIndex: number): void;
  /** Moves in on one stop; the road is drawn as far as the coach has come. */
  focusStop(stopIndex: number): void;
  /** Highlights the stop the coach is at, or none while it is on the road. */
  setActiveStop(stopIndex: number | null): void;
  /** Marks every stop up to and including the index as already visited. */
  setVisitedThrough(stopIndex: number): void;
  /** Changes the light on the map to a time of day. */
  setTimeOfDay(time: TimeOfDay): void;
  /** Tells the view which part of its area is covered by panels. */
  setPadding(padding: ViewPadding): void;
  /** Registers a callback that runs once per rendered frame. */
  onFrame(callback: (deltaSeconds: number) => void): void;
  start(): void;
}
