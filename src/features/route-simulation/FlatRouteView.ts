import { segmentPath, smoothSegments } from '@/domain/geo/spline';
import type { RoutePlan } from '@/domain/tour/RoutePlan';
import type { StopKind } from '@/domain/tour/Tour';
import { mapData, ringsToSvgPath } from '@/features/map3d/MapData';
import type { ViewPadding } from '@/shared/lifecycle';
import { easeLeg } from './RouteSimulation';
import type { RouteView, TimeOfDay } from './RouteView';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const RESPONSE = 3.2;
const STOP_FRAME_KM = 170;
const MIN_STOP_FRAME_KM = 45;
/** Kilometres shown across the map per kilometre of free room around a stop. */
const STOP_FRAME_PER_CLEARANCE = 12;
const MAX_DELTA_SECONDS = 0.1;
const NO_PADDING: ViewPadding = { left: 0, right: 0, top: 0, bottom: 0 };
/** Stops that carry their name on the map all the time; the others show it when the coach arrives. */
const NAMED_KINDS: ReadonlySet<StopKind> = new Set(['departure', 'lodging']);

function svg<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

/**
 * The same route on a flat SVG map, for devices without WebGL. It follows the
 * coach by animating the viewBox, so it needs no library and no GPU features.
 */
export class FlatRouteView implements RouteView {
  private readonly root = svg('svg', { class: 'flat-map', 'aria-hidden': 'true' });
  private readonly routeLayer = svg('g');
  private readonly coach = svg('circle', { class: 'flat-map__coach' });
  /** A warm wash over the map that fades in at dusk. */
  private readonly dusk = document.createElement('div');
  private readonly callbacks = new Set<(deltaSeconds: number) => void>();
  private readonly box: Box = { x: 0, y: 0, width: 1, height: 1 };
  private readonly wanted: Box = { x: 0, y: 0, width: 1, height: 1 };
  private plan: RoutePlan | undefined;
  private legs: SVGPathElement[] = [];
  /** Length of each leg in map units, measured once. */
  private lengths: number[] = [];
  /** Share of each leg currently drawn as travelled road, 0 to 1. */
  private drawn: number[] = [];
  private stops: SVGGElement[] = [];
  private following = false;
  /** In the overview the whole road is drawn; on the journey only the part already driven. */
  private wholeRoad = true;
  private followSpan = STOP_FRAME_KM;
  private padding: ViewPadding = NO_PADDING;
  private frameHandle = 0;
  private lastTime = 0;

  constructor(private readonly host: HTMLElement) {
    this.root.append(
      svg('path', { class: 'flat-map__neighbour', d: ringsToSvgPath(mapData.neighboursCoarse) }),
      svg('path', { class: 'flat-map__land', d: ringsToSvgPath(mapData.turkeyCoarse) }),
      svg('path', { class: 'flat-map__lake', d: ringsToSvgPath(Object.values(mapData.lakes)) }),
      this.routeLayer,
    );
    this.dusk.className = 'flat-map__dusk';
    host.append(this.root, this.dusk);
  }

  showRoute(plan: RoutePlan): void {
    this.plan = plan;
    this.routeLayer.replaceChildren();
    // North is up on the map but SVG's y axis points down.
    const points = plan.stops.map((stop) => ({ x: stop.point.x, y: -stop.point.y }));

    // Each leg is its own path so progress along it can be measured and drawn.
    this.legs = smoothSegments(points).map((segment) => {
      const d = segmentPath(segment);
      const leg = svg('path', { class: 'flat-map__leg', d });
      this.routeLayer.append(svg('path', { class: 'flat-map__plan', d }), leg);
      return leg;
    });

    this.lengths = this.legs.map((leg) => leg.getTotalLength());
    this.drawn = [];

    const named = new Set<string>();
    this.stops = plan.stops.map((stop, index) => {
      const point = points[index] ?? { x: 0, y: 0 };
      const group = svg('g', {
        class: `flat-map__stop flat-map__stop--${stop.stop.kind}`,
        transform: `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`,
      });
      // A town the coach returns to is named once.
      if (NAMED_KINDS.has(stop.stop.kind) && !named.has(stop.stop.name)) {
        named.add(stop.stop.name);
        group.classList.add('flat-map__stop--named');
      }
      const label = svg('text');
      label.textContent = stop.stop.name;
      group.append(svg('circle'), label);
      this.routeLayer.append(group);
      return group;
    });
    this.routeLayer.append(this.coach);
    this.setPosition(0, 0);
  }

  setPosition(legIndex: number, legProgress: number): void {
    const current = Math.min(legIndex, this.legs.length - 1);
    const leg = this.legs[current];
    if (!leg) return;
    const eased = easeLeg(legProgress);
    const point = leg.getPointAtLength((this.lengths[current] ?? 0) * eased);
    this.coach.setAttribute('cx', point.x.toFixed(1));
    this.coach.setAttribute('cy', point.y.toFixed(1));
    this.legs.forEach((path, index) => {
      const total = this.lengths[index] ?? 0;
      const share = this.wholeRoad || index < legIndex ? 1 : index === legIndex ? eased : 0;
      // This runs every frame; only a leg whose drawn length changed is touched.
      if (share === this.drawn[index]) return;
      this.drawn[index] = share;
      path.style.strokeDasharray = `${(total * share).toFixed(1)} ${(total + 1).toFixed(1)}`;
    });
    if (this.following) this.frame(point.x, point.y, this.followSpan);
  }

  showOverview(immediate = false): void {
    if (!this.plan) return;
    this.following = false;
    this.wholeRoad = true;
    const { minX, maxX, minY, maxY } = this.plan.bounds;
    const { freeWidth, freeHeight } = this.area;
    const span = Math.max(maxX - minX, (maxY - minY) * (freeWidth / freeHeight)) * 1.35 + 80;
    this.frame((minX + maxX) / 2, -(minY + maxY) / 2, span);
    if (immediate) Object.assign(this.box, this.wanted);
    this.applyBox();
  }

  followCoach(legIndex: number): void {
    this.following = true;
    this.wholeRoad = false;
    this.followSpan = Math.min(
      620,
      Math.max(STOP_FRAME_KM, (this.plan?.legKm(legIndex) ?? 0) * 1.8),
    );
  }

  focusStop(stopIndex: number): void {
    const stop = this.plan?.stops[stopIndex];
    if (!stop) return;
    this.following = false;
    this.wholeRoad = false;
    // Stops that crowd together are looked at from closer, so they can be told apart.
    const span = (this.plan?.clearanceKm(stopIndex) ?? Infinity) * STOP_FRAME_PER_CLEARANCE;
    this.frame(
      stop.point.x,
      -stop.point.y,
      Math.min(STOP_FRAME_KM, Math.max(MIN_STOP_FRAME_KM, span)),
    );
  }

  setActiveStop(stopIndex: number | null): void {
    this.stops.forEach((stop, index) => {
      const active = index === stopIndex;
      stop.classList.toggle('flat-map__stop--active', active);
      // Drawn last among the stops, so no neighbour's marker sits on its name.
      if (active) this.routeLayer.insertBefore(stop, this.coach);
    });
  }

  setVisitedThrough(stopIndex: number): void {
    this.stops.forEach((stop, index) => {
      stop.classList.toggle('flat-map__stop--visited', index <= stopIndex);
    });
  }

  setTimeOfDay(time: TimeOfDay): void {
    this.dusk.dataset['on'] = String(time === 'dusk');
  }

  setPadding(padding: ViewPadding): void {
    this.padding = padding;
  }

  onFrame(callback: (deltaSeconds: number) => void): void {
    this.callbacks.add(callback);
  }

  start(): void {
    if (this.frameHandle !== 0) return;
    this.lastTime = performance.now();
    this.frameHandle = requestAnimationFrame(this.tick);
  }

  dispose(): void {
    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
    this.callbacks.clear();
    this.root.remove();
    this.dusk.remove();
  }

  /** The map's size in pixels and the part of it that no panel covers. */
  private get area(): {
    width: number;
    height: number;
    left: number;
    top: number;
    freeWidth: number;
    freeHeight: number;
  } {
    const width = this.host.clientWidth || 1;
    const height = this.host.clientHeight || 1;
    const { left, right, top, bottom } = this.padding;
    return {
      width,
      height,
      left,
      top,
      freeWidth: Math.max(1, width - left - right),
      freeHeight: Math.max(1, height - top - bottom),
    };
  }

  /** Aims the view so that `span` kilometres fit across the free part, centred on a point. */
  private frame(centerX: number, centerY: number, span: number): void {
    const { width, height, left, top, freeWidth, freeHeight } = this.area;
    const pixelsPerKm = freeWidth / span;
    this.wanted.width = width / pixelsPerKm;
    this.wanted.height = height / pixelsPerKm;
    this.wanted.x = centerX - (left + freeWidth / 2) / pixelsPerKm;
    this.wanted.y = centerY - (top + freeHeight / 2) / pixelsPerKm;
  }

  private readonly tick = (now: number): void => {
    this.frameHandle = requestAnimationFrame(this.tick);
    const delta = Math.min((now - this.lastTime) / 1000, MAX_DELTA_SECONDS);
    this.lastTime = now;
    for (const callback of this.callbacks) callback(delta);
    const blend = 1 - Math.exp(-delta * RESPONSE);
    this.box.x += (this.wanted.x - this.box.x) * blend;
    this.box.y += (this.wanted.y - this.box.y) * blend;
    this.box.width += (this.wanted.width - this.box.width) * blend;
    this.box.height += (this.wanted.height - this.box.height) * blend;
    this.applyBox();
  };

  private applyBox(): void {
    const { x, y, width, height } = this.box;
    this.root.setAttribute(
      'viewBox',
      `${x.toFixed(1)} ${y.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}`,
    );
    // Map units per pixel: sizes written with it stay constant on screen at any zoom.
    this.root.style.setProperty('--px', (width / this.area.width).toFixed(4));
  }
}
