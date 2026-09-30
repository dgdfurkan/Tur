import { MathUtils, Vector3 } from 'three';
import type { RoutePlan } from '@/domain/tour/RoutePlan';
import type { StopKind } from '@/domain/tour/Tour';
import { easeLeg } from '@/features/route-simulation/RouteSimulation';
import type { RouteView } from '@/features/route-simulation/RouteView';
import type { ViewPadding } from '@/shared/lifecycle';
import { BusModel } from './BusModel';
import { MapWorld } from './MapWorld';
import type { QualityProfile } from './QualityProfile';
import { RouteTrack } from './RouteTrack';
import { StopMarkers } from './StopMarkers';
import { coachScale, KM_PER_UNIT, LAND_TOP, markerScale } from './world';

const STOP_PRIORITY: Record<StopKind, number> = {
  departure: 90,
  arrival: 90,
  lodging: 70,
  sight: 60,
  rest: 50,
};

const OVERVIEW_PITCH = 54;
const FOLLOW_PITCH = 45;
const STOP_PITCH = 41;
const STOP_DISTANCE = 12;
const MIN_FOLLOW_DISTANCE = 11;
const MAX_FOLLOW_DISTANCE = 48;
const OVERVIEW_MARGIN = 5;
const HEADING_RESPONSE = 7;

/** The 3D map as a route view: draws one tour's road, stops and coach on the shared world. */
export class ThreeRouteView implements RouteView {
  private readonly world: MapWorld;
  private readonly bus: BusModel;
  private readonly position = new Vector3();
  private readonly direction = new Vector3();
  private readonly scratch = new Vector3();
  private plan: RoutePlan | undefined;
  private track: RouteTrack | undefined;
  private markers: StopMarkers | undefined;
  private labelOfStop: string[] = [];
  private following = false;
  private heading = 0;
  private wantedHeading = 0;
  private motion = 0;
  private lastDistance = 0;
  private followDistance = MIN_FOLLOW_DISTANCE;
  private activeLabel: string | undefined;

  constructor(
    canvas: HTMLCanvasElement,
    labelContainer: HTMLElement,
    quality: QualityProfile,
    reducedMotion = false,
  ) {
    this.world = new MapWorld(canvas, labelContainer, quality, reducedMotion);
    this.bus = new BusModel(this.world.kit);
    this.bus.group.visible = false;
    this.world.scene.add(this.bus.group);
    this.world.rig.moveTo(this.world.overviewPose(), true);
    this.world.onFrame((delta, elapsed) => this.animate(delta, elapsed));
  }

  showRoute(plan: RoutePlan): void {
    this.clearRoute();
    this.plan = plan;
    this.track = new RouteTrack(plan);
    this.markers = new StopMarkers(plan, this.track);
    this.world.scene.add(this.track.group, this.markers.group);

    // Two stops at the same place (a town visited on consecutive days) share one sign.
    const signs: { id: string; name: string; position: Vector3 }[] = [];
    this.labelOfStop = plan.stops.map((stop) => {
      const position = this.track?.stopPosition(stop.index, new Vector3()) ?? new Vector3();
      const twin = signs.find(
        (sign) => sign.name === stop.stop.name && sign.position.distanceTo(position) < 0.5,
      );
      if (twin) return twin.id;
      const id = `stop:${stop.index}`;
      signs.push({ id, name: stop.stop.name, position });
      this.world.labels.add(
        id,
        stop.stop.name,
        position.clone().setY(LAND_TOP + 0.25),
        'stop',
        STOP_PRIORITY[stop.stop.kind] - stop.index * 0.01,
      );
      return id;
    });

    this.bus.group.visible = true;
    this.heading = Number.NaN;
    this.setPosition(0, 0);
  }

  setPosition(legIndex: number, legProgress: number): void {
    if (!this.track) return;
    const distance = this.track.distanceAt(legIndex, easeLeg(legProgress));
    this.track.positionAt(distance, this.position);
    this.track.directionAt(distance, this.direction);
    this.track.reveal(legIndex, easeLeg(legProgress));
    this.bus.group.position.copy(this.position);
    this.wantedHeading = Math.atan2(-this.direction.z, this.direction.x);
    if (Number.isNaN(this.heading)) this.heading = this.wantedHeading;
    this.motion = distance === this.lastDistance ? 0 : 1;
    this.lastDistance = distance;
  }

  showOverview(immediate = false): void {
    if (!this.plan) return;
    this.following = false;
    const { minX, maxX, minY, maxY } = this.plan.bounds;
    const halfWidth = (maxX - minX) / 2 / KM_PER_UNIT + OVERVIEW_MARGIN;
    const halfDepth = (maxY - minY) / 2 / KM_PER_UNIT + OVERVIEW_MARGIN;
    this.world.rig.moveTo(
      {
        target: new Vector3(
          (minX + maxX) / 2 / KM_PER_UNIT,
          LAND_TOP,
          -(minY + maxY) / 2 / KM_PER_UNIT,
        ),
        distance: this.world.rig.distanceToFit(halfWidth, halfDepth, OVERVIEW_PITCH),
        pitch: OVERVIEW_PITCH,
      },
      immediate,
    );
  }

  followCoach(legIndex: number): void {
    if (!this.plan) return;
    this.following = true;
    // A long motorway leg is watched from further away than a hop between valleys.
    const legUnits = this.plan.legKm(legIndex) / KM_PER_UNIT;
    this.followDistance = MathUtils.clamp(legUnits * 1.7, MIN_FOLLOW_DISTANCE, MAX_FOLLOW_DISTANCE);
  }

  focusStop(stopIndex: number): void {
    if (!this.track) return;
    this.following = false;
    this.world.rig.moveTo({
      target: this.track.stopPosition(stopIndex, new Vector3()),
      distance: STOP_DISTANCE,
      pitch: STOP_PITCH,
    });
  }

  setActiveStop(stopIndex: number | null): void {
    this.markers?.setActive(stopIndex);
    this.labelOfStop.forEach((id, index) => {
      if (index === stopIndex) this.world.labels.setState(id, 'active');
      else if (this.activeLabel === id) this.world.labels.setState(id, 'visited');
    });
    this.activeLabel = stopIndex === null ? undefined : this.labelOfStop[stopIndex];
  }

  setVisitedThrough(stopIndex: number): void {
    const visited = new Set(this.labelOfStop.slice(0, stopIndex + 1));
    for (const id of new Set(this.labelOfStop)) {
      if (id === this.activeLabel) continue;
      this.world.labels.setState(id, visited.has(id) ? 'visited' : 'idle');
    }
  }

  setPadding(padding: ViewPadding): void {
    this.world.setPadding(padding);
  }

  onFrame(callback: (deltaSeconds: number) => void): void {
    this.world.onFrame(callback);
  }

  start(): void {
    this.world.start();
  }

  dispose(): void {
    this.clearRoute();
    this.bus.dispose();
    this.world.dispose();
  }

  private animate(deltaSeconds: number, elapsedSeconds: number): void {
    const distance = this.world.rig.distance;
    this.bus.group.scale.setScalar(coachScale(distance));
    this.markers?.setScale(markerScale(distance));
    this.markers?.update(elapsedSeconds);

    if (!Number.isNaN(this.heading)) {
      const turn = Math.atan2(
        Math.sin(this.wantedHeading - this.heading),
        Math.cos(this.wantedHeading - this.heading),
      );
      this.heading += turn * (1 - Math.exp(-deltaSeconds * HEADING_RESPONSE));
      this.bus.group.rotation.y = this.heading;
    }
    this.bus.bounce(elapsedSeconds, this.motion);

    if (this.following) {
      this.world.rig.moveTo({
        target: this.scratch.copy(this.position),
        distance: this.followDistance,
        pitch: FOLLOW_PITCH,
      });
    }
  }

  private clearRoute(): void {
    if (this.track) {
      this.world.scene.remove(this.track.group);
      this.track.dispose();
    }
    if (this.markers) {
      this.world.scene.remove(this.markers.group);
      this.markers.dispose();
    }
    this.world.labels.remove('stop:');
    this.track = undefined;
    this.markers = undefined;
    this.labelOfStop = [];
    this.activeLabel = undefined;
  }
}
