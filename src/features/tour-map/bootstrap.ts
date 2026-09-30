import type { RouteOutline } from '@/application/dto/RouteOutline';
import { supportsWebGL } from '@/shared/webgl';

const OPTION_NAME = 'tour-map';
const ALL_ROUTES = 'all';

function selectedTour(root: HTMLElement): string | null {
  const checked = root.querySelector<HTMLInputElement>(`input[name="${OPTION_NAME}"]:checked`);
  return !checked || checked.value === ALL_ROUTES ? null : checked.value;
}

async function start(root: HTMLElement): Promise<void> {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-map-canvas]');
  const labels = root.querySelector<HTMLElement>('[data-map-labels]');
  const routesUrl = root.dataset['routesUrl'];
  if (!canvas || !labels || !routesUrl || !supportsWebGL()) return;

  const [{ TourMapShowcase }, { detectQuality }, response] = await Promise.all([
    import('./TourMapShowcase'),
    import('@/features/map3d/QualityProfile'),
    fetch(routesUrl),
  ]);
  if (!response.ok) throw new Error(`Route outlines failed to load: ${response.status}`);
  const outlines = (await response.json()) as RouteOutline[];

  const showcase = new TourMapShowcase(
    canvas,
    labels,
    detectQuality(),
    matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  showcase.setRoutes(outlines);
  showcase.select(selectedTour(root));
  showcase.start();
  root.dataset['ready'] = 'true';

  root.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.name === OPTION_NAME) {
      showcase.select(selectedTour(root));
    }
  });
  addEventListener('pagehide', () => showcase.dispose(), { once: true });
}

/**
 * Starts the home page map once it is about to scroll into view. Until then,
 * and on devices without WebGL, the static map rendered with the page stays.
 */
export function mountTourMap(root: HTMLElement): void {
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      start(root).catch((error: unknown) => {
        console.warn('Interactive tour map unavailable; the static map stays.', error);
      });
    },
    { rootMargin: '300px' },
  );
  observer.observe(root);
}
