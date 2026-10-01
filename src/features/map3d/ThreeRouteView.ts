import { MathUtils, Vector3 } from 'three';
import type { RoutePlan } from '@/domain/tour/RoutePlan';
import type { StopKind } from '@/domain/tour/Tour';
import { easeLeg } from '@/features/route-simulation/RouteSimulation';
import type { OverviewOptions, RouteView } from '@/features/route-simulation/RouteView';
import type { ViewPadding } from '@/shared/lifecycle';
import type { TimeOfDay } from '@/shared/timeOfDay';
import { BusModel } from './BusModel';
import { DustTrail } from './DustTrail';
import type { FixedFrame, MapSurface } from './MapSurface';
import { MapWorld } from './MapWorld';
import type { QualityProfile } from './QualityProfile';
import { RouteTrack } from './RouteTrack';
import { StopMarkers } from './StopMarkers';
import { coachScale, KM_PER_UNIT, LAND_TOP, markerScale, roadScale } from './world';

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
const MIN_STOP_DISTANCE = 7;
/** Camera distance per unit of free room around a stop: crowded stops are viewed from closer. */
const STOP_DISTANCE_PER_CLEARANCE = 14;
const MIN_FOLLOW_DISTANCE = 9;
const MAX_FOLLOW_DISTANCE = 34;
/** Camera distance per unit of leg length: near enough for the coach to be the subject. */
const FOLLOW_DISTANCE_PER_UNIT = 1.15;
const OVERVIEW_MARGIN = 5;
const HEADING_RESPONSE = 7;
/** The camera aims this far ahead of the coach in time, a little more than it trails behind. */
const LOOK_AHEAD_SECONDS = 0.36;
const VELOCITY_RESPONSE = 5;
const MAX_LOOK_AHEAD_SPEED = 14;
/** Width of the strip along the road that is kept free of trees and landmarks, per side. */
const ROADSIDE_CLEARANCE = 0.45;
/** Furthest the coach can drive in one frame, in world units; anything longer is a jump. */
const MAX_STEP = 2;

/** The 3D map as a route view: draws one tour's road, stops and coach on the shared world. */
export class ThreeRouteView implements RouteView {
  private readonly bus: BusModel;
  private readonly dust = new DustTrail();
  private readonly position = new Vector3();
  private readonly direction = new Vector3();
  private readonly scratch = new Vector3();
  private readonly previous = new Vector3();
  private readonly velocity = new Vector3();
  private plan: RoutePlan | undefined;
  private track: RouteTrack | undefined;
  private markers: StopMarkers | undefined;
  private labelOfStop: string[] = [];
  private following = false;
  /** In the overview the whole road is drawn; on the journey only the part already driven. */
  private wholeRoad = true;
  private heading = 0;
  private wantedHeading = 0;
  private motion = 0;
  private lastDistance = 0;
  private followDistance = MIN_FOLLOW_DISTANCE;
  private activeLabel: string | undefined;

  /** Builds the map in stages; resolves when the first frame can be drawn cheaply. */
  static async create(
    surface: MapSurface,
    quality: QualityProfile,
    reducedMotion = false,
  ): Promise<ThreeRouteView> {
    return new ThreeRouteView(await MapWorld.create(surface, quality, reducedMotion));
  }

  private constructor(private readonly world: MapWorld) {
    this.bus = new BusModel(this.world.kit);
    this.bus.group.visible = false;
    this.world.scene.add(this.bus.group, this.dust.group);
    this.world.rig.moveTo(this.world.overviewPose(), true);
    this.world.onFrame((delta, elapsed) => this.animate(delta, elapsed));
  }

  showRoute(plan: RoutePlan): void {
    this.clearRoute();
    this.plan = plan;
    this.track = new RouteTrack(plan);
    this.markers = new StopMarkers(plan, this.track);
    this.world.scene.add(this.track.group, this.markers.group);
    this.world.keepClear(this.track.path, ROADSIDE_CLEARANCE);

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
    this.following = false;
    this.wholeRoad = true;
    this.setPosition(0, 0);
  }

  setPosition(legIndex: number, legProgress: number): void {
    if (!this.track) return;
    const distance = this.track.distanceAt(legIndex, easeLeg(legProgress));
    this.track.positionAt(distance, this.position);
    this.track.directionAt(distance, this.direction);
    if (this.wholeRoad) this.track.revealAll();
    else this.track.reveal(legIndex, easeLeg(legProgress));
    this.bus.group.position.copy(this.position);
    this.wantedHeading = Math.atan2(-this.direction.z, this.direction.x);
    if (Number.isNaN(this.heading)) this.heading = this.wantedHeading;
    const travelled = distance - this.lastDistance;
    this.motion = travelled === 0 ? 0 : 1;
    this.lastDistance = distance;
    // A jump to another stop is not driving: the wheels stay still and no dust rises.
    if (Math.abs(travelled) < MAX_STEP) this.bus.roll(travelled / this.bus.group.scale.x);
    else this.dust.settle();
  }

  showOverview({ immediate = false, road = 'whole' }: OverviewOptions = {}): void {
    if (!this.plan) return;
    this.following = false;
    this.wholeRoad = road === 'whole';
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
    this.wholeRoad = false;
    this.previous.copy(this.position);
    this.velocity.set(0, 0, 0);
    // A long motorway leg is watched from further away than a hop between valleys.
    const legUnits = this.plan.legKm(legIndex) / KM_PER_UNIT;
    this.followDistance = MathUtils.clamp(
      legUnits * FOLLOW_DISTANCE_PER_UNIT,
      MIN_FOLLOW_DISTANCE,
      MAX_FOLLOW_DISTANCE,
    );
  }

  focusStop(stopIndex: number): void {
    if (!this.track || !this.plan) return;
    this.following = false;
    this.wholeRoad = false;
    const clearance = this.plan.clearanceKm(stopIndex) / KM_PER_UNIT;
    this.world.rig.moveTo({
      target: this.track.stopPosition(stopIndex, new Vector3()),
      distance: MathUtils.clamp(
        clearance * STOP_DISTANCE_PER_CLEARANCE,
        MIN_STOP_DISTANCE,
        STOP_DISTANCE,
      ),
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

  setTimeOfDay(time: TimeOfDay): void {
    this.world.setTimeOfDay(time);
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

  /** Gets the map ready to be drawn frame by frame, without starting a loop. */
  async prepare(): Promise<void> {
    await this.world.prepare();
  }

  /** Moves the map on by `deltaSeconds` and draws one frame. */
  step(deltaSeconds: number): void {
    this.world.step(deltaSeconds);
  }

  /** The canvas the map is drawn on. */
  get canvas(): HTMLCanvasElement {
    return this.world.canvas;
  }

  /** Gives a map that is drawn frame by frame another size or sharpness. */
  reframe(frame: FixedFrame): void {
    this.world.reframe(frame);
  }

  dispose(): void {
    this.clearRoute();
    this.bus.dispose();
    this.dust.dispose();
    this.world.dispose();
  }

  private animate(deltaSeconds: number, elapsedSeconds: number): void {
    const { view } = this.world.rig;
    this.bus.group.scale.setScalar(coachScale(view));
    this.track?.setScale(roadScale(view));
    this.markers?.setScale(markerScale(view));
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
    const size = this.bus.group.scale.x;
    this.dust.update(
      deltaSeconds,
      this.motion === 1,
      this.scratch.copy(this.position).addScaledVector(this.direction, -0.5 * size),
      size,
    );

    if (this.following) {
      // Aiming ahead of the coach makes up for the camera trailing it, so the road to come stays in view.
      if (deltaSeconds > 0) {
        this.scratch
          .subVectors(this.position, this.previous)
          .divideScalar(deltaSeconds)
          .clampLength(0, MAX_LOOK_AHEAD_SPEED);
        this.velocity.lerp(this.scratch, 1 - Math.exp(-deltaSeconds * VELOCITY_RESPONSE));
      }
      this.previous.copy(this.position);
      this.world.rig.moveTo({
        target: this.scratch.copy(this.position).addScaledVector(this.velocity, LOOK_AHEAD_SECONDS),
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
    this.world.keepClear([]);
    this.track = undefined;
    this.markers = undefined;
    this.labelOfStop = [];
    this.activeLabel = undefined;
  }
}
