import { Vector3 } from 'three';
import { toRoutePlan, type RouteOutline } from '@/application/dto/RouteOutline';
import type { RoutePlan } from '@/domain/tour/RoutePlan';
import { BusModel } from '@/features/map3d/BusModel';
import type { MapSurface } from '@/features/map3d/MapSurface';
import { MapWorld } from '@/features/map3d/MapWorld';
import type { QualityProfile } from '@/features/map3d/QualityProfile';
import { RouteTrack } from '@/features/map3d/RouteTrack';
import { StopMarkers } from '@/features/map3d/StopMarkers';
import { coachScale, KM_PER_UNIT, LAND_TOP, markerScale, roadScale } from '@/features/map3d/world';
import type { Disposable } from '@/shared/lifecycle';

interface ShowcaseRoute {
  readonly plan: RoutePlan;
  readonly track: RouteTrack;
  readonly bus: BusModel;
  /** Where along the road the coach starts, so the coaches are spread out. */
  readonly offset: number;
}

/** World units per second; about 60 km of map per second. */
const CRUISE_SPEED = 6;
const SELECTED_PITCH = 52;
const FRAME_MARGIN = 5;
/** Where a parked coach sits on its road when motion is reduced. */
const PARKED_FRACTION = 0.3;

/**
 * The home page map: every tour's road on one board, with a coach circling
 * each. Selecting a tour brings its road forward and frames it.
 */
export class TourMapShowcase implements Disposable {
  private readonly routes = new Map<string, ShowcaseRoute>();
  private readonly position = new Vector3();
  private readonly direction = new Vector3();
  private markers: StopMarkers | undefined;
  private selected: string | null = null;

  /** Builds the map in stages; resolves when the first frame can be drawn cheaply. */
  static async create(
    surface: MapSurface,
    quality: QualityProfile,
    reducedMotion: boolean,
  ): Promise<TourMapShowcase> {
    return new TourMapShowcase(
      await MapWorld.create(surface, quality, reducedMotion),
      reducedMotion,
    );
  }

  private constructor(
    private readonly world: MapWorld,
    private readonly reducedMotion: boolean,
  ) {
    this.world.rig.moveTo(this.world.overviewPose(), true);
    this.world.onFrame((_delta, elapsed) => this.animate(elapsed));
  }

  setRoutes(outlines: readonly RouteOutline[]): void {
    outlines.forEach((outline, index) => {
      const plan = toRoutePlan(outline);
      const track = new RouteTrack(plan);
      track.revealAll();
      const bus = new BusModel(this.world.kit);
      this.world.scene.add(track.group, bus.group);
      this.routes.set(outline.id, {
        plan,
        track,
        bus,
        offset: (index / outlines.length) * track.length,
      });
    });
  }

  /** Brings one tour's road forward, or shows every tour equally with `null`. */
  select(id: string | null): void {
    this.selected = id !== null && this.routes.has(id) ? id : null;
    for (const [routeId, route] of this.routes) {
      const isOther = this.selected !== null && routeId !== this.selected;
      route.track.setMuted(isOther);
      route.bus.group.visible = !isOther;
    }

    this.world.labels.remove('stop:');
    if (this.markers) {
      this.world.scene.remove(this.markers.group);
      this.markers.dispose();
      this.markers = undefined;
    }

    const route = this.selected === null ? undefined : this.routes.get(this.selected);
    if (!route) {
      this.world.rig.moveTo(this.world.overviewPose());
      return;
    }

    this.markers = new StopMarkers(route.plan, route.track);
    this.world.scene.add(this.markers.group);
    const named = new Set<string>();
    for (const stop of route.plan.stops) {
      if (stop.stop.kind === 'rest' || named.has(stop.stop.name)) continue;
      named.add(stop.stop.name);
      this.world.labels.add(
        `stop:${stop.index}`,
        stop.stop.name,
        route.track.stopPosition(stop.index, new Vector3()).setY(LAND_TOP + 0.25),
        'stop',
        80 - stop.index * 0.01,
      );
    }

    const { minX, maxX, minY, maxY } = route.plan.bounds;
    this.world.rig.moveTo({
      target: new Vector3(
        (minX + maxX) / 2 / KM_PER_UNIT,
        LAND_TOP,
        -(minY + maxY) / 2 / KM_PER_UNIT,
      ),
      distance: this.world.rig.distanceToFit(
        (maxX - minX) / 2 / KM_PER_UNIT + FRAME_MARGIN,
        (maxY - minY) / 2 / KM_PER_UNIT + FRAME_MARGIN,
        SELECTED_PITCH,
      ),
      pitch: SELECTED_PITCH,
    });
  }

  start(): void {
    this.world.start();
  }

  dispose(): void {
    for (const route of this.routes.values()) {
      route.track.dispose();
      route.bus.dispose();
    }
    this.routes.clear();
    this.markers?.dispose();
    this.world.dispose();
  }

  private animate(elapsedSeconds: number): void {
    const { view } = this.world.rig;
    const scale = coachScale(view);
    const width = roadScale(view);
    this.markers?.setScale(markerScale(view));
    for (const route of this.routes.values()) {
      const { track, bus } = route;
      track.setScale(width);
      const distance = this.reducedMotion
        ? track.length * PARKED_FRACTION
        : (elapsedSeconds * CRUISE_SPEED + route.offset) % track.length;
      track.positionAt(distance, this.position);
      track.directionAt(distance, this.direction);
      bus.group.position.copy(this.position);
      bus.group.rotation.y = Math.atan2(-this.direction.z, this.direction.x);
      bus.group.scale.setScalar(scale);
      bus.bounce(elapsedSeconds, this.reducedMotion ? 0 : 1);
    }
  }
}
