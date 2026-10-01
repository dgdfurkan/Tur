import type { RoutePlan } from '@/domain/tour/RoutePlan';
import { uneaseLeg } from '@/features/route-simulation/RouteSimulation';
import type { RouteView } from '@/features/route-simulation/RouteView';
import type { FilmLayout } from './FilmLayout';
import { overlayAt, type FilmOverlay } from './FilmOverlay';
import type { FilmMoment, Storyboard, TimedShot } from './Storyboard';

function smoothstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

/**
 * Turns a storyboard into instructions for the map: where the coach is, what
 * the camera watches, which stop is lit. It speaks to the map through the same
 * RouteView interface as the live simulation.
 */
export class FilmDirector {
  private entered = -1;

  constructor(
    private readonly plan: RoutePlan,
    private readonly storyboard: Storyboard,
    private readonly stage: RouteView,
    private readonly framing: FilmLayout['framing'],
  ) {
    stage.showRoute(plan);
  }

  /** Forgets where the film was, so the next frame can be any moment of it. */
  rewind(): void {
    this.entered = -1;
  }

  /** Sets the map for the moment at `time` and returns what is painted over it. */
  direct(time: number): FilmOverlay {
    const moment = this.storyboard.at(time);
    if (moment.index !== this.entered) {
      this.enter(moment.shot, this.entered === -1);
      this.entered = moment.index;
    }
    this.place(moment);
    return overlayAt(moment, this.plan);
  }

  /** What a shot sets once, when it begins. */
  private enter(shot: TimedShot, first: boolean): void {
    const { stage, plan, framing } = this;
    const lastStop = plan.stops.length - 1;
    switch (shot.kind) {
      case 'title':
      case 'boarding':
        stage.setActiveStop(null);
        stage.setVisitedThrough(-1);
        stage.setTimeOfDay('day');
        stage.setPadding(framing.overview);
        stage.showOverview({ immediate: first });
        break;
      case 'trace':
        stage.setActiveStop(null);
        stage.setVisitedThrough(-1);
        stage.setTimeOfDay('day');
        stage.setPadding(framing.overview);
        stage.showOverview({ immediate: first, road: 'travelled' });
        break;
      case 'drive':
        stage.setActiveStop(null);
        stage.setVisitedThrough(shot.legIndex);
        stage.setTimeOfDay('day');
        stage.setPadding(framing.drive);
        stage.followCoach(shot.legIndex);
        break;
      case 'stop': {
        const stop = plan.stops[shot.stopIndex];
        stage.setVisitedThrough(shot.stopIndex - 1);
        stage.setActiveStop(shot.stopIndex);
        stage.setTimeOfDay(stop?.stop.kind === 'lodging' ? 'dusk' : 'day');
        stage.setPadding(framing.stop);
        stage.focusStop(shot.stopIndex);
        break;
      }
      case 'outro':
        stage.setActiveStop(null);
        stage.setVisitedThrough(lastStop);
        stage.setTimeOfDay('day');
        stage.setPadding(framing.overview);
        stage.showOverview({ immediate: first });
        break;
    }
  }

  /** Where the coach is at a moment; set on every frame. */
  private place(moment: FilmMoment): void {
    const { stage, plan } = this;
    const { shot } = moment;
    const lastLeg = plan.legCount - 1;
    switch (shot.kind) {
      case 'title':
      case 'boarding':
        stage.setPosition(0, 0);
        break;
      case 'drive':
        stage.setPosition(shot.legIndex, moment.progress);
        break;
      case 'stop':
        // The last stop has no leg of its own; it is the end of the one before.
        if (shot.stopIndex > lastLeg) stage.setPosition(lastLeg, 1);
        else stage.setPosition(shot.stopIndex, 0);
        break;
      case 'trace':
        this.placeAlongRoute(smoothstep(moment.progress));
        break;
      case 'outro':
        stage.setPosition(lastLeg, 1);
        break;
    }
  }

  /** Puts the coach at a share of the whole route's length, at a steady pace through the stops. */
  private placeAlongRoute(share: number): void {
    const { plan, stage } = this;
    const travelled = share * plan.totalKm;
    const last = plan.legCount - 1;
    let leg = 0;
    while (leg < last && (plan.stops[leg + 1]?.distanceKm ?? 0) <= travelled) leg += 1;
    const from = plan.stops[leg]?.distanceKm ?? 0;
    const length = plan.legKm(leg);
    const along = length === 0 ? 1 : (travelled - from) / length;
    // The view eases each leg; undoing that keeps the coach from slowing at every stop.
    stage.setPosition(leg, uneaseLeg(along));
  }
}
