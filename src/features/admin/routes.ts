import type { AppContext, Screen } from './context';
import { hotelsScreen, listScreen, programScreen } from './screens/content';
import { departureScreen } from './screens/departure';
import { departureEditScreen } from './screens/departureEdit';
import { homeScreen } from './screens/home';
import { journeyFormScreen, journeyScreen, journeysScreen } from './screens/journeys';
import { passengerFormScreen } from './screens/passengerForm';
import { passengersScreen } from './screens/passengers';
import { shownToursScreen, siteScreen } from './screens/site';
import { tourScreen } from './screens/tour';
import { toursScreen } from './screens/tours';

type Params = Readonly<Record<string, string>>;
type Factory = (params: Params, query: URLSearchParams, context: AppContext) => Screen | null;

/**
 * Every address of the panel. A segment starting with a colon names a part of
 * the address the screen receives.
 */
const ROUTES: readonly (readonly [string, Factory])[] = [
  ['/', () => homeScreen()],
  ['/kalkis/:departure', (params) => departureScreen(params['departure'] ?? '')],
  ['/turlar', () => toursScreen()],
  [
    '/turlar/:tour',
    (params, _query, context) =>
      known(params['tour'], context) ? tourScreen(params['tour'] ?? '') : null,
  ],
  [
    '/turlar/:tour/kalkis/:departure',
    (params) => departureEditScreen(params['tour'] ?? '', params['departure'] ?? ''),
  ],
  ['/turlar/:tour/program', (params) => programScreen(params['tour'] ?? '')],
  [
    '/turlar/:tour/liste/:list',
    (params) =>
      params['list'] === 'dahil' || params['list'] === 'haric'
        ? listScreen(params['tour'] ?? '', params['list'])
        : null,
  ],
  ['/turlar/:tour/konaklama', (params) => hotelsScreen(params['tour'] ?? '')],
  ['/gecmis', () => journeysScreen()],
  ['/gecmis/yeni', (_params, query) => journeyFormScreen({ departureId: query.get('kalkis') })],
  [
    '/gecmis/:journey',
    (params, _query, context) =>
      context.journeys.journey(params['journey'] ?? '')
        ? journeyScreen(params['journey'] ?? '')
        : null,
  ],
  ['/yolcular', () => passengersScreen()],
  [
    '/yolcular/yeni',
    (_params, query) =>
      passengerFormScreen({
        departureId: query.get('kalkis'),
        seat:
          Number.isInteger(Number(query.get('koltuk'))) && query.get('koltuk')
            ? Number(query.get('koltuk'))
            : null,
      }),
  ],
  [
    '/yolcular/:passenger',
    (params) => passengerFormScreen({ passengerId: params['passenger'] ?? '' }),
  ],
  ['/site', () => siteScreen()],
  ['/site/turlar', () => shownToursScreen()],
];

function known(tourId: string | undefined, context: AppContext): boolean {
  return tourId !== undefined && context.catalog.tour(tourId) !== undefined;
}

function match(pattern: string, path: string): Params | null {
  const want = pattern.split('/').filter(Boolean);
  const have = path.split('/').filter(Boolean);
  if (want.length !== have.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i += 1) {
    const expected = want[i] ?? '';
    const actual = have[i] ?? '';
    if (expected.startsWith(':')) params[expected.slice(1)] = actual;
    else if (expected !== actual) return null;
  }
  return params;
}

/** The screen an address names, or null when it names none. */
export function resolveRoute(address: string, context: AppContext): Screen | null {
  const [path = '/', search = ''] = address.split('?');
  const query = new URLSearchParams(search);
  for (const [pattern, factory] of ROUTES) {
    const params = match(pattern, path);
    if (params) return factory(params, query, context) || null;
  }
  return null;
}
