import type { TourSnapshot } from '@/application/dto/TourData';
import { toTour } from '@/application/tourMapper';
import { RoutePlan } from '@/domain/tour/RoutePlan';
import { detectQuality } from '@/features/map3d/QualityProfile';
import { SafeStorage } from '@/infrastructure/storage/SafeStorage';
import { formatDuration } from '@/shared/format';
import { routeSummary } from '@/shared/routeSummary';
import { mapChoice, openGraphics } from '@/shared/webgl';
import { RouteSimulation } from './RouteSimulation';
import type { RouteView } from './RouteView';
import { SimulationController, type BoardingRitual } from './SimulationController';
import { SimulationPanel } from './SimulationPanel';
import { SoundManager } from './SoundManager';

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Route page is missing ${selector}`);
  return element;
}

/**
 * Prefers the 3D map where a graphics chip can draw it and falls back to the
 * flat one; whichever is used is only downloaded once that is known.
 */
async function createView(root: HTMLElement, reducedMotion: boolean): Promise<RouteView> {
  const stage = required<HTMLElement>(root, '[data-stage]');
  const choice = mapChoice(location.search);
  const quality = detectQuality();
  const canvas = required<HTMLCanvasElement>(stage, '[data-map-canvas]');
  const context =
    choice === 'flat'
      ? null
      : openGraphics(canvas, { antialias: quality.antialias, allowSoftware: choice === '3d' });
  if (context) {
    try {
      const { ThreeRouteView } = await import('@/features/map3d/ThreeRouteView');
      const labels = required<HTMLElement>(stage, '[data-map-labels]');
      const view = await ThreeRouteView.create({ canvas, context, labels }, quality, reducedMotion);
      root.dataset['map'] = '3d';
      return view;
    } catch (error) {
      console.warn('3D map unavailable, using the flat map instead.', error);
    }
  }
  root.dataset['map'] = 'flat';
  const { FlatRouteView } = await import('./FlatRouteView');
  return new FlatRouteView(stage);
}

/**
 * The boarding pass and its animation library are only needed once the visitor
 * presses start, so they are fetched while the browser is idle instead of up front.
 */
function lazyBoardingPass(
  root: HTMLElement,
  sound: SoundManager,
  reducedMotion: boolean,
): BoardingRitual {
  const load = () => import('./BoardingPass');
  if ('requestIdleCallback' in globalThis) requestIdleCallback(() => void load());
  return {
    play: async () => {
      const { BoardingPass } = await load();
      await new BoardingPass(root, sound, reducedMotion).play();
    },
  };
}

/** Composition root of the route preview page. */
export async function mountRouteSimulation(root: HTMLElement): Promise<void> {
  const snapshot = JSON.parse(
    required<HTMLScriptElement>(root, '[data-tour]').textContent ?? '',
  ) as TourSnapshot;
  const tour = toTour(snapshot);
  const plan = RoutePlan.fromTour(tour);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const view = await createView(root, reducedMotion);
  const sound = new SoundManager(new SafeStorage());
  const controller = new SimulationController(
    plan,
    new RouteSimulation(plan),
    view,
    new SimulationPanel(root),
    lazyBoardingPass(required<HTMLElement>(root, '[data-boarding-pass]'), sound, reducedMotion),
    sound,
    {
      duration: formatDuration(tour.nights, tour.dayCount),
      summary: routeSummary(tour),
      stepMode: reducedMotion,
    },
  );
  root.dataset['ready'] = 'true';
  if (reducedMotion) root.dataset['step'] = 'true';
  // Frees the WebGL context and the audio graph when the page is left.
  addEventListener('pagehide', () => controller.dispose(), { once: true });
}
