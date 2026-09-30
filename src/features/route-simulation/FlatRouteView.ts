import { segmentPath, smoothSegments } from '@/domain/geo/spline';
import type { RoutePlan } from '@/domain/tour/RoutePlan';
import { mapData, ringsToSvgPath } from '@/features/map3d/MapData';
import type { ViewPadding } from '@/shared/lifecycle';
import { easeLeg } from './RouteSimulation';
import type { RouteView } from './RouteView';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const RESPONSE = 3.2;
const STOP_FRAME_KM = 170;
const MAX_DELTA_SECONDS = 0.1;

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
  private readonly callbacks = new Set<(deltaSeconds: number) => void>();
  private readonly box: Box = { x: 0, y: 0, width: 1, height: 1 };
  private readonly wanted: Box = { x: 0, y: 0, width: 1, height: 1 };
  private plan: RoutePlan | undefined;
  private legs: SVGPathElement[] = [];
  private stops: SVGGElement[] = [];
  private following = false;
  private followSpan = STOP_FRAME_KM;
  private frameHandle = 0;
  private lastTime = 0;

  constructor(private readonly host: HTMLElement) {
    this.root.append(
      svg('path', { class: 'flat-map__neighbour', d: ringsToSvgPath(mapData.neighboursCoarse) }),
      svg('path', { class: 'flat-map__land', d: ringsToSvgPath(mapData.turkeyCoarse) }),
      svg('path', { class: 'flat-map__lake', d: ringsToSvgPath(Object.values(mapData.lakes)) }),
      this.routeLayer,
    );
    host.append(this.root);
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

    this.stops = plan.stops.map((stop, index) => {
      const point = points[index] ?? { x: 0, y: 0 };
      const group = svg('g', {
        class: `flat-map__stop flat-map__stop--${stop.stop.kind}`,
        transform: `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`,
      });
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
    const leg = this.legs[Math.min(legIndex, this.legs.length - 1)];
    if (!leg) return;
    const eased = easeLeg(legProgress);
    const length = leg.getTotalLength();
    const point = leg.getPointAtLength(length * eased);
    this.coach.setAttribute('cx', point.x.toFixed(1));
    this.coach.setAttribute('cy', point.y.toFixed(1));
    this.legs.forEach((path, index) => {
      const total = path.getTotalLength();
      const drawn = index < legIndex ? total : index === legIndex ? total * eased : 0;
      path.style.strokeDasharray = `${drawn.toFixed(1)} ${(total + 1).toFixed(1)}`;
    });
    if (this.following) this.frame(point.x, point.y, this.followSpan);
  }

  showOverview(immediate = false): void {
    if (!this.plan) return;
    this.following = false;
    const { minX, maxX, minY, maxY } = this.plan.bounds;
    const span = Math.max(maxX - minX, (maxY - minY) * this.aspect) * 1.35 + 80;
    this.frame((minX + maxX) / 2, -(minY + maxY) / 2, span);
    if (immediate) Object.assign(this.box, this.wanted);
    this.applyBox();
  }

  followCoach(legIndex: number): void {
    this.following = true;
    this.followSpan = Math.min(
      620,
      Math.max(STOP_FRAME_KM, (this.plan?.legKm(legIndex) ?? 0) * 1.8),
    );
  }

  focusStop(stopIndex: number): void {
    const stop = this.plan?.stops[stopIndex];
    if (!stop) return;
    this.following = false;
    this.frame(stop.point.x, -stop.point.y, STOP_FRAME_KM);
  }

  setActiveStop(stopIndex: number | null): void {
    this.stops.forEach((stop, index) => {
      stop.classList.toggle('flat-map__stop--active', index === stopIndex);
    });
  }

  setVisitedThrough(stopIndex: number): void {
    this.stops.forEach((stop, index) => {
      stop.classList.toggle('flat-map__stop--visited', index <= stopIndex);
    });
  }

  setPadding(_padding: ViewPadding): void {
    // The flat map is letterboxed by the SVG itself; panels overlap it slightly.
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
  }

  private get aspect(): number {
    const { clientWidth, clientHeight } = this.host;
    return clientHeight === 0 ? 1.6 : clientWidth / clientHeight;
  }

  private frame(centerX: number, centerY: number, width: number): void {
    const height = width / this.aspect;
    this.wanted.x = centerX - width / 2;
    this.wanted.y = centerY - height / 2;
    this.wanted.width = width;
    this.wanted.height = height;
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
    // Marker and text sizes are written in this unit so they stay constant on screen.
    this.root.style.setProperty('--unit', (width / 100).toFixed(3));
  }
}
