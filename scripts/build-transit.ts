import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiLineString,
  Point,
  Position,
} from 'geojson';
import type { TransitLineProps, TransitStationProps } from '../src/types.ts';
import { byteSize, douglasPeucker, mergeWays, normaliseName, roundCoords } from './lib.ts';

const RAW_DIR = 'data/raw/transit';
const OUT_DIR = 'data/layers';
const MAX_BYTES = 350_000;

// --- Overpass raw shapes for route_master -> route -> way/node trees -------
// (broader than scripts/lib.ts's OverpassResponse, which only models the
// flat way list `fetch-roads`/`build-gage` need.)

interface RawTags {
  [key: string]: string;
}

interface RawMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
  geometry?: { lat: number; lon: number }[];
}

interface RawNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: RawTags;
}

interface RawRelation {
  type: 'relation';
  id: number;
  tags?: RawTags;
  members: RawMember[];
}

type RawElement = RawNode | { type: 'way'; id: number; tags?: RawTags } | RawRelation;

interface RawResponse {
  elements: RawElement[];
}

interface TransitSourceItem {
  id: string;
  kind: string;
  query: string;
  colour: string;
}

interface TransitSourceFile {
  bbox: string;
  items: TransitSourceItem[];
}

// Ways carry the line geometry; a route's platform/stop members are excluded
// by role, so only the running way itself (role "", or a direction split
// tagged "forward"/"backward") ever contributes to the MultiLineString.
const LINE_WAY_ROLES = new Set(['', 'forward', 'backward']);

// ~11 m at Jakarta's latitude; enough to shrink KRL's ~17k raw vertices
// under the 350 KB budget without visibly distorting a driver's map.
const LINE_SIMPLIFY_TOLERANCE_DEG = 0.0001;

// A handful of OSM colour names that show up on KRL routes instead of hex.
const NAMED_COLOURS: Record<string, string> = {
  red: '#FF0000',
  blue: '#0000FF',
  green: '#008000',
  brown: '#A52A2A',
  pink: '#FFC0CB',
  orange: '#FFA500',
  purple: '#800080',
  yellow: '#FFD700',
  black: '#000000',
  white: '#FFFFFF',
  grey: '#808080',
  gray: '#808080',
};

// Normalises an OSM `colour` tag to `#RRGGBB`: passes through a valid hex
// value, maps a small table of CSS colour names (OSM sometimes uses `red`,
// `Pink`, etc. instead of hex), and otherwise falls back to `fallback`.
export function toHexColour(s: string | undefined, fallback: string): string {
  const trimmed = s?.trim();
  if (!trimmed) return fallback;
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed.slice(1).toUpperCase()}`;
  return NAMED_COLOURS[trimmed.toLowerCase()] ?? fallback;
}

// Derives a route_master's corridor ref: `tags.ref` when present, else the
// trailing 1-2 digit number in its name (e.g. "Transjakarta BRT 2" -> "2",
// used when a Transjakarta master has no `ref` tag of its own).
export function masterRef(tags: RawTags | undefined): string | undefined {
  const ref = tags?.ref?.trim();
  if (ref) return ref;
  const name = tags?.name?.trim();
  if (!name) return undefined;
  const m = /(\d{1,2})$/.exec(name);
  return m?.[1];
}

// A relation is non-operational when its own tags mark it proposed, under
// construction, or disused. OSM spells this several ways depending on how
// the mapper recorded it: a bare `construction`/`disused` value, `state`
// set to anything but open/operational, or a `proposed:*`/`construction:*`/
// `disused:*` prefixed key (e.g. `proposed:railway=subway`).
export function isOperational(tags: RawTags | undefined): boolean {
  if (!tags) return true;
  if (tags.disused === 'yes') return false;
  if (tags.construction) return false;
  if (tags.state && tags.state !== 'operational' && tags.state !== 'open') return false;
  for (const key of Object.keys(tags)) {
    if (
      key.startsWith('proposed:') ||
      key.startsWith('construction:') ||
      key.startsWith('disused:')
    ) {
      return false;
    }
  }
  return true;
}

// Station-selection rank for a node's tags (lower is better; -1 = not a
// station for this network). Transjakarta halte are tagged as bus platforms,
// not railway stations, so they get their own rule; the rail networks prefer
// a proper `public_transport=station`/`railway=station|halt` node and fall
// back to a `stop_position` node carrying the mode-specific `*=yes` tag.
export function stationRank(tags: RawTags | undefined, itemId: string): number {
  if (!tags?.name) return -1;
  if (itemId === 'transjakarta') {
    return tags.highway === 'bus_stop' || tags.public_transport === 'platform' ? 0 : -1;
  }
  if (tags.public_transport === 'station') return 0;
  if (tags.railway === 'station' || tags.railway === 'halt') return 1;
  if (
    tags.public_transport === 'stop_position' &&
    (tags.train === 'yes' || tags.subway === 'yes' || tags.light_rail === 'yes')
  ) {
    return 2;
  }
  return -1;
}

function elementLine(el: { geometry?: { lat: number; lon: number }[] }): Position[] {
  return (el.geometry ?? []).map((p) => [p.lon, p.lat] as Position);
}

function isRelation(el: RawElement): el is RawRelation {
  return el.type === 'relation';
}

function isNode(el: RawElement): el is RawNode {
  return el.type === 'node';
}

// Route relations belonging to `master` (nested route_masters aren't a thing
// in this data, so any relation member tagged `type=route` qualifies).
function memberRoutes(master: RawRelation, relationsById: Map<number, RawRelation>): RawRelation[] {
  const routes: RawRelation[] = [];
  for (const m of master.members) {
    if (m.type !== 'relation') continue;
    const rel = relationsById.get(m.ref);
    if (rel?.tags?.type === 'route') routes.push(rel);
  }
  return routes;
}

// Line-geometry ways directly on `rel` (a route_master may embed a couple of
// ways itself alongside its route members, as MRT's East-West master does).
function collectWays(rel: RawRelation): Position[][] {
  const ways: Position[][] = [];
  for (const m of rel.members) {
    if (m.type !== 'way' || !LINE_WAY_ROLES.has(m.role)) continue;
    const line = elementLine(m);
    if (line.length >= 2) ways.push(line);
  }
  return ways;
}

interface StationBest {
  name: string;
  network: string;
  rank: number;
  lon: number;
  lat: number;
}

// Folds one route/master's node members into the running per-file station
// maps: `best` keeps the highest-ranked (name, network, coords) seen so far
// per normalised name, `lines` accumulates every ref that serves that name
// regardless of which node instance won the rank.
// Same name within ~600 m is the same station (long KRL platforms) (stop_position vs station node,
// both directions); same name further apart is a different place and stays separate.
const SAME_STATION_M = 600;

function metresBetween(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = (lat2 - lat1) * 111_320;
  const dLon = (lon2 - lon1) * 111_320 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

// Returns the map key for this station: an existing same-name entry within
// SAME_STATION_M, else a new key suffixed with an index.
export function stationKey(
  name: string,
  lon: number,
  lat: number,
  best: ReadonlyMap<string, { lon: number; lat: number }>,
): string {
  const base = normaliseName(name);
  for (let i = 0; ; i++) {
    const key = i === 0 ? base : `${base}#${String(i)}`;
    const existing = best.get(key);
    if (!existing) return key;
    if (metresBetween(lon, lat, existing.lon, existing.lat) <= SAME_STATION_M) return key;
  }
}

function collectStations(
  rel: RawRelation,
  nodesById: Map<number, RawNode>,
  itemId: string,
  ref: string,
  network: string,
  best: Map<string, StationBest>,
  lines: Map<string, Set<string>>,
): void {
  for (const m of rel.members) {
    if (m.type !== 'node') continue;
    const node = nodesById.get(m.ref);
    const tags = node?.tags;
    if (!node || !tags?.name) continue;
    const rank = stationRank(tags, itemId);
    if (rank < 0) continue;
    const key = stationKey(tags.name, node.lon, node.lat, best);
    const current = best.get(key);
    if (!current || rank < current.rank) {
      best.set(key, { name: tags.name, network, rank, lon: node.lon, lat: node.lat });
    }
    const set = lines.get(key) ?? new Set<string>();
    set.add(ref);
    lines.set(key, set);
  }
}

const NUMERIC = { numeric: true } as const;

interface BuiltItem {
  lineFeatures: Feature<MultiLineString, TransitLineProps>[];
  stationFeatures: Feature<Point, TransitStationProps>[];
  dataAsOf: string;
}

function buildItem(item: TransitSourceItem): BuiltItem {
  const rawPath = join(RAW_DIR, `${item.id}.json`);
  const dataAsOf = new Date(statSync(rawPath).mtimeMs).toISOString().slice(0, 10);
  const raw = JSON.parse(readFileSync(rawPath, 'utf8')) as RawResponse;

  const nodesById = new Map<number, RawNode>();
  const relationsById = new Map<number, RawRelation>();
  for (const el of raw.elements) {
    if (isNode(el)) nodesById.set(el.id, el);
    else if (isRelation(el)) relationsById.set(el.id, el);
  }

  const masters = raw.elements.filter(isRelation).filter((r) => r.tags?.type === 'route_master');

  const stationBest = new Map<string, StationBest>();
  const stationLines = new Map<string, Set<string>>();
  const lineFeatures: Feature<MultiLineString, TransitLineProps>[] = [];

  for (const master of masters) {
    // Transjakarta's route_master pool includes Minitrans/Metrotrans feeder
    // parents pulled in via `rel(br)`; keep only the 13-14 numbered BRT
    // corridors themselves.
    if (item.id === 'transjakarta' && !/^Transjakarta BRT \d{1,2}$/.test(master.tags?.name ?? '')) {
      continue;
    }
    if (!isOperational(master.tags)) continue;

    const routes = memberRoutes(master, relationsById);
    const operationalRoutes = routes.filter((r) => isOperational(r.tags));
    // A master whose only route(s) are all proposed/under construction has
    // nothing operational to show (MRT's East-West Line, still fully
    // proposed as of this fetch).
    if (routes.length > 0 && operationalRoutes.length === 0) continue;

    const ref = masterRef(master.tags);
    const name = master.tags?.name;
    if (!ref || !name) continue;

    const ways = [...collectWays(master), ...operationalRoutes.flatMap((r) => collectWays(r))];
    if (ways.length === 0) continue;
    const coordinates = mergeWays(ways).map((line) =>
      douglasPeucker(line, LINE_SIMPLIFY_TOLERANCE_DEG),
    );

    const firstRoute = operationalRoutes[0];
    const colour = toHexColour(
      master.tags?.colour ?? firstRoute?.tags?.colour,
      toHexColour(item.colour, item.colour),
    );
    const network = master.tags?.network ?? firstRoute?.tags?.network ?? '';
    const operator = master.tags?.operator ?? firstRoute?.tags?.operator;

    const properties: TransitLineProps = {
      ref,
      name,
      colour,
      network,
      ...(operator ? { operator } : {}),
      data_as_of: dataAsOf,
    };
    lineFeatures.push({
      type: 'Feature',
      properties,
      geometry: { type: 'MultiLineString', coordinates },
    });

    collectStations(master, nodesById, item.id, ref, network, stationBest, stationLines);
    for (const route of operationalRoutes) {
      collectStations(route, nodesById, item.id, ref, network, stationBest, stationLines);
    }
  }

  lineFeatures.sort(
    (a, b) =>
      a.properties.ref.localeCompare(b.properties.ref, undefined, NUMERIC) ||
      a.properties.name.localeCompare(b.properties.name, undefined, NUMERIC),
  );

  const stationFeatures: Feature<Point, TransitStationProps>[] = Array.from(
    stationBest.entries(),
  ).map(([key, s]) => {
    const refs = Array.from(stationLines.get(key) ?? []).sort((a, b) =>
      a.localeCompare(b, undefined, NUMERIC),
    );
    const properties: TransitStationProps = { name: s.name, network: s.network, lines: refs };
    return {
      type: 'Feature',
      properties,
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    };
  });
  stationFeatures.sort((a, b) =>
    a.properties.name.localeCompare(b.properties.name, undefined, NUMERIC),
  );

  return { lineFeatures, stationFeatures, dataAsOf };
}

function writeLayer(
  id: string,
  built: BuiltItem,
): { lines: number; stations: number; bytes: number } {
  let stations = built.stationFeatures;
  let dropped = false;

  // Transjakarta's hundreds of halte across 14 corridors are the only case
  // large enough to blow the budget even after line simplification; the
  // other networks always keep their stations (Review Focus / plan: KRL
  // must keep >=40).
  if (id === 'transjakarta') {
    const withStations = assemble(built.lineFeatures, stations, built.dataAsOf);
    if (byteSize(withStations) > MAX_BYTES && stations.length > 0) {
      stations = [];
      dropped = true;
    }
  }

  const fc = assemble(built.lineFeatures, stations, built.dataAsOf);
  const rounded = roundCoords(fc, 5);
  const json = JSON.stringify(rounded);
  writeFileSync(join(OUT_DIR, `${id}.geojson`), json);
  if (dropped) {
    console.log(
      `${id}: dropped station points, lines-only file exceeded ${String(MAX_BYTES)} bytes with stations`,
    );
    noteStationsDropped(id);
  }
  return {
    lines: built.lineFeatures.length,
    stations: stations.length,
    bytes: Buffer.byteLength(json, 'utf8'),
  };
}

function assemble(
  lineFeatures: Feature<MultiLineString, TransitLineProps>[],
  stationFeatures: Feature<Point, TransitStationProps>[],
  dataAsOf: string,
): FeatureCollection<Geometry, TransitLineProps | TransitStationProps> & {
  properties: { data_as_of: string; source: string[] };
} {
  return {
    type: 'FeatureCollection',
    features: [...lineFeatures, ...stationFeatures],
    properties: {
      data_as_of: dataAsOf,
      source: ['https://www.openstreetmap.org/copyright'],
    },
  };
}

const SOURCE_PATH = 'data/sources/transit.json';

// Records in the recipe that an item's build dropped its station points for
// exceeding the size budget, so a future reader of transit.json doesn't have
// to rediscover it by diffing file sizes.
function noteStationsDropped(id: string): void {
  const raw = JSON.parse(readFileSync(SOURCE_PATH, 'utf8')) as Record<string, unknown>;
  const items = raw.items as Record<string, unknown>[];
  const item = items.find((i) => i.id === id);
  if (!item || item.stations === false) return;
  item.stations = false;
  writeFileSync(SOURCE_PATH, JSON.stringify(raw, null, 2) + '\n');
}

function main(): void {
  const source = JSON.parse(readFileSync(SOURCE_PATH, 'utf8')) as TransitSourceFile;
  for (const item of source.items) {
    const built = buildItem(item);
    const stats = writeLayer(item.id, built);
    console.log(
      `${item.id}: lines=${String(stats.lines)} stations=${String(stats.stations)} bytes=${String(stats.bytes)}`,
    );
  }
}

// Guarded so this module can be imported for its pure helpers (tests) without
// running the build (which reads/writes the data directory) as a side effect.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
