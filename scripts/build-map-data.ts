/**
 * Generates the projected outline of Turkey and its neighbours from Natural
 * Earth data (public domain, via the world-atlas package). The output is
 * committed, so normal builds need neither this script nor the network.
 *
 * Run with: npm run map:build
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Geometry, Position } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import atlasJson from 'world-atlas/countries-50m.json' with { type: 'json' };
import { TURKEY_PROJECTION } from '../src/domain/geo/MapProjection.ts';

type Ring = [number, number][];

const atlas = atlasJson as unknown as Topology<{ countries: GeometryCollection }>;

/**
 * Frame in degrees. It reaches well past Turkey so that the straight edges
 * where neighbours are clipped stay outside every camera view.
 */
const FRAME = { west: 20.5, east: 50.5, south: 30.5, north: 46.5 };

const TURKEY_ID = '792';
const NEIGHBOUR_IDS = new Set([
  '300', // Greece
  '100', // Bulgaria
  '642', // Romania
  '498', // Moldova
  '804', // Ukraine
  '643', // Russia
  '268', // Georgia
  '051', // Armenia
  '031', // Azerbaijan
  '364', // Iran
  '368', // Iraq
  '760', // Syria
  '422', // Lebanon
  '376', // Israel
  '275', // Palestine
  '400', // Jordan
  '682', // Saudi Arabia
  '414', // Kuwait
  '818', // Egypt
  '196', // Cyprus
  '807', // North Macedonia
  '688', // Serbia
  '008', // Albania
]);

/** Lakes are absent from country data; these outlines are hand-approximated. */
const LAKES: Record<string, [number, number][]> = {
  van: [
    [38.95, 42.95],
    [39.0, 43.3],
    [38.85, 43.55],
    [38.6, 43.4],
    [38.4, 43.2],
    [38.3, 42.8],
    [38.45, 42.5],
    [38.65, 42.3],
    [38.8, 42.55],
  ],
  tuz: [
    [39.05, 33.35],
    [39.0, 33.55],
    [38.8, 33.6],
    [38.55, 33.75],
    [38.4, 33.6],
    [38.55, 33.35],
    [38.75, 33.2],
    [38.95, 33.15],
  ],
};

const toRing = (positions: Position[]): Ring =>
  positions.map((position) => [position[0] ?? 0, position[1] ?? 0]);

function outerRings(geometry: Geometry): Ring[] {
  if (geometry.type === 'Polygon') {
    const outer = geometry.coordinates[0];
    return outer ? [toRing(outer)] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap((polygon) => (polygon[0] ? [toRing(polygon[0])] : []));
  }
  return [];
}

/** Sutherland–Hodgman clip of a ring against the rectangular frame. */
function clipToFrame(ring: Ring): Ring {
  const edges: {
    inside: (p: [number, number]) => boolean;
    cut: (a: [number, number], b: [number, number]) => [number, number];
  }[] = [
    {
      inside: (p) => p[0] >= FRAME.west,
      cut: (a, b) => [FRAME.west, a[1] + ((b[1] - a[1]) * (FRAME.west - a[0])) / (b[0] - a[0])],
    },
    {
      inside: (p) => p[0] <= FRAME.east,
      cut: (a, b) => [FRAME.east, a[1] + ((b[1] - a[1]) * (FRAME.east - a[0])) / (b[0] - a[0])],
    },
    {
      inside: (p) => p[1] >= FRAME.south,
      cut: (a, b) => [a[0] + ((b[0] - a[0]) * (FRAME.south - a[1])) / (b[1] - a[1]), FRAME.south],
    },
    {
      inside: (p) => p[1] <= FRAME.north,
      cut: (a, b) => [a[0] + ((b[0] - a[0]) * (FRAME.north - a[1])) / (b[1] - a[1]), FRAME.north],
    },
  ];

  let output = ring;
  for (const edge of edges) {
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i += 1) {
      const current = input[i];
      const previous = input[(i + input.length - 1) % input.length];
      if (!current || !previous) continue;
      const currentInside = edge.inside(current);
      const previousInside = edge.inside(previous);
      if (currentInside) {
        if (!previousInside) output.push(edge.cut(previous, current));
        output.push(current);
      } else if (previousInside) {
        output.push(edge.cut(previous, current));
      }
    }
  }
  return output;
}

function project(ring: Ring): Ring {
  return ring.map(([lon, lat]) => {
    const point = TURKEY_PROJECTION.project({ lat, lon });
    return [point.x, point.y];
  });
}

/** Douglas–Peucker simplification; tolerance in kilometres. */
function simplify(ring: Ring, tolerance: number): Ring {
  if (ring.length < 5) return ring;
  const keep = new Array<boolean>(ring.length).fill(false);
  keep[0] = true;
  keep[ring.length - 1] = true;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length > 0) {
    const segment = stack.pop();
    if (!segment) break;
    const [first, last] = segment;
    const a = ring[first];
    const b = ring[last];
    if (!a || !b) continue;
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const p = ring[i];
      if (!p) continue;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const lengthSquared = dx * dx + dy * dy;
      const t =
        lengthSquared === 0
          ? 0
          : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
      const distance = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > tolerance) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

function ringArea(ring: Ring): number {
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (a && b) area += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(area) / 2;
}

const round = (ring: Ring): Ring =>
  ring.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);

function prepare(rings: Ring[], tolerance: number, minArea: number): Ring[] {
  return rings
    .map((ring) => clipToFrame(ring))
    .filter((ring) => ring.length >= 3)
    .map((ring) => project(ring))
    .filter((ring) => ringArea(ring) >= minArea)
    .map((ring) => round(simplify(ring, tolerance)))
    .filter((ring) => ring.length >= 3)
    .sort((a, b) => ringArea(b) - ringArea(a));
}

const collection = feature(atlas, atlas.objects.countries);

const turkeyRings: Ring[] = [];
const neighbourRings: Ring[] = [];
for (const country of collection.features) {
  const id = String(country.id ?? '').padStart(3, '0');
  if (id === TURKEY_ID) turkeyRings.push(...outerRings(country.geometry));
  else if (NEIGHBOUR_IDS.has(id)) neighbourRings.push(...outerRings(country.geometry));
}

if (turkeyRings.length === 0) {
  throw new Error('Turkey was not found in the atlas');
}

const frameCorners = project([
  [FRAME.west, FRAME.south],
  [FRAME.east, FRAME.north],
]);
const [southWest, northEast] = frameCorners;
if (!southWest || !northEast) throw new Error('Frame projection failed');

const data = {
  attribution: 'Made with Natural Earth',
  bounds: {
    minX: Math.round(southWest[0]),
    minY: Math.round(southWest[1]),
    maxX: Math.round(northEast[0]),
    maxY: Math.round(northEast[1]),
  },
  turkey: prepare(turkeyRings, 1.2, 150),
  turkeyCoarse: prepare(turkeyRings, 6, 600),
  neighbours: prepare(neighbourRings, 5, 300),
  neighboursCoarse: prepare(neighbourRings, 14, 1500),
  lakes: Object.fromEntries(
    Object.entries(LAKES).map(([name, points]) => [
      name,
      round(project(points.map(([lat, lon]) => [lon, lat] as [number, number]))),
    ]),
  ),
};

const target = fileURLToPath(new URL('../src/features/map3d/data/turkey.json', import.meta.url));
writeFileSync(target, `${JSON.stringify(data)}\n`);

const count = (rings: Ring[]): number => rings.reduce((sum, ring) => sum + ring.length, 0);
console.warn(
  `turkey.json written: ${data.turkey.length} rings / ${count(data.turkey)} points, ` +
    `coarse ${count(data.turkeyCoarse)} points, neighbours ${data.neighbours.length} rings / ` +
    `${count(data.neighbours)} points, coarse ${count(data.neighboursCoarse)} points`,
);
