import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

export type Bbox = [number, number, number, number]; // minLon, minLat, maxLon, maxLat

export interface OverpassWay {
  type: 'way';
  id: number;
  tags?: Record<string, string>;
  geometry: { lat: number; lon: number }[];
}

export interface OverpassResponse {
  elements: OverpassWay[];
}

// Overpass QL string literals process \" and \\ escapes before the value is
// used as a regex, so a JS regex source must be escaped one extra level.
export function qlString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export const JKT_AREA = 'area["ISO3166-2"="ID-JK"]->.jk;';

// Road classes relevant to ganjil-genap corridors; dropping service/footway/
// cycleway/path keeps data/gage.geojson small.
export const HIGHWAY_FILTER =
  '["highway"~"^(primary|secondary|tertiary|trunk|primary_link|secondary_link|tertiary_link|trunk_link|motorway_link)$"]';

export function buildQuery(osmNameRegex: string): string {
  return `[out:json][timeout:60];${JKT_AREA}way(area.jk)${HIGHWAY_FILTER}["name"~"${qlString(osmNameRegex)}"];out geom;`;
}

export function inBbox(p: Position, c: Bbox): boolean {
  const [lon = NaN, lat = NaN] = p;
  return lon >= c[0] && lat >= c[1] && lon <= c[2] && lat <= c[3];
}

// Split a line into the runs of vertices that lie inside the bbox. Vertices
// outside are dropped, so a road that crosses the box edge is cut at the last
// inside vertex (at most one OSM segment short of the exact boundary).
export function clipLine(line: Position[], c: Bbox | undefined): Position[][] {
  if (!c) return [line];
  const out: Position[][] = [];
  let run: Position[] = [];
  for (const p of line) {
    if (inBbox(p, c)) {
      run.push(p);
    } else if (run.length > 0) {
      out.push(run);
      run = [];
    }
  }
  if (run.length > 0) out.push(run);
  return out.filter((r) => r.length >= 2);
}

// --- Generic Overpass runner (scripts/fetch-osm.ts) ---------------------

export type ItemKind = 'ways' | 'nodes' | 'relations' | 'route_master';

export interface SourceItem {
  id: string;
  name: string;
  group: string;
  note?: string;
  clip?: Bbox;
  // ISO3166-2 code (e.g. "ID-JK"); overrides the source-level area/bbox for
  // this item when set.
  area?: string;
  kind: ItemKind;
  // A full Overpass element selector, e.g. `way["highway"~"..."]["name"~"..."]`,
  // without the trailing bbox/area filter (buildQl appends that).
  query: string;
}

export interface SourceFile {
  bbox: string; // "minLat,minLon,maxLat,maxLon" (Overpass bbox order)
  area?: string; // ISO3166-2 code; used instead of bbox for every item unless overridden
  items: SourceItem[];
}

// Appends the bbox/area filter to every `;`-separated selector in a query
// (an item's query may be a single selector or a union of several), so
// `"way[a];way[b]"` becomes `"way[a](bbox);way[b](bbox)"`.
function withSpatialFilter(query: string, bboxOrArea: string): string {
  return query
    .split(';')
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0)
    .map((clause) => `${clause}(${bboxOrArea})`)
    .join(';');
}

// `kind: "ways"|"nodes"|"relations"` -> plain element query.
//
// `kind: "route_master"` -> Overpass has no spatial index on relations, so a
// route_master can't be bbox/area-filtered directly, and neither can its
// member routes' member ways/nodes without first resolving the routes
// themselves. The item.query for this kind selects the child ROUTE
// relations (`type=route`), which ARE addressable by bbox; buildQl then:
//   1. selects those routes in the bbox/area -> .r
//   2. walks up to their route_master parents via `rel(br.r)` (backward
//      relations of .r) -> unions with .r into .m
//   3. walks back down to every route belonging to those masters via
//      `rel(r.m)` -> unions with .m into .rr
//   4. recurses (`>>`) from .m + .rr down to their member ways/nodes so the
//      output carries full line geometry (Task A5).
export function buildQl(item: SourceItem, source: SourceFile): string {
  const areaIso = item.area ?? source.area;
  const areaClause = areaIso ? `area["ISO3166-2"="${areaIso}"]->.jk;` : '';
  const bboxOrArea = areaIso ? 'area.jk' : source.bbox;
  const prefix = `[out:json][timeout:120];${areaClause}`;
  const filteredQuery = withSpatialFilter(item.query, bboxOrArea);
  if (item.kind === 'route_master') {
    return (
      `${prefix}(${filteredQuery};)->.r;` +
      `(.r;rel(br.r)["type"="route_master"];)->.m;` +
      `(.m;rel(r.m);)->.rr;` +
      `(.m;.rr;.rr>>;);out geom;`
    );
  }
  return `${prefix}(${filteredQuery};);out geom;`;
}

// --- Shared post-processing helpers (build-*.ts scripts) -----------------

type NumberTree = number | NumberTree[];

function roundNumberTree(t: NumberTree, dp: number): NumberTree {
  if (typeof t === 'number') {
    const f = 10 ** dp;
    return Math.round(t * f) / f;
  }
  return t.map((x) => roundNumberTree(x, dp));
}

// Rounds every coordinate of every feature's geometry to `dp` decimal places.
// GeometryCollection features (no `coordinates`) pass through unchanged.
export function roundCoords<G extends Geometry, P>(
  fc: FeatureCollection<G, P>,
  dp: number,
): FeatureCollection<G, P> {
  const features = fc.features.map((f): Feature<G, P> => {
    const geom = f.geometry as unknown as { coordinates?: NumberTree };
    if (!geom.coordinates) return f;
    const coordinates = roundNumberTree(geom.coordinates, dp);
    const geometry = { ...f.geometry, coordinates } as unknown as G;
    return { ...f, geometry };
  });
  return { ...fc, features };
}

// UTF-8 byte length of a value's JSON representation; used for the ≤2 MB data
// budget checks.
export function byteSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

const ENDPOINT_EPS = 1e-6;

function samePoint(a: Position, b: Position): boolean {
  const [ax = NaN, ay = NaN] = a;
  const [bx = NaN, by = NaN] = b;
  return Math.abs(ax - bx) <= ENDPOINT_EPS && Math.abs(ay - by) <= ENDPOINT_EPS;
}

// Chains ways whose endpoints coincide (within 1e-6 degrees) into single
// lines, reversing a candidate as needed; ways that don't connect to
// anything stay separate. Used to turn OSM's many short route-member ways
// into as few MultiLineString parts as possible.
export function mergeWays(ways: Position[][]): Position[][] {
  const pool = ways.map((w) => w.slice());
  const result: Position[][] = [];
  while (pool.length > 0) {
    const next = pool.shift();
    if (!next) break;
    let chain = next;
    let extended = true;
    while (extended) {
      extended = false;
      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[i];
        if (!candidate) continue;
        const [chainStart] = chain;
        const chainEnd = chain[chain.length - 1];
        const [candStart] = candidate;
        const candEnd = candidate[candidate.length - 1];
        if (!chainStart || !chainEnd || !candStart || !candEnd) continue;
        if (samePoint(chainEnd, candStart)) {
          chain = chain.concat(candidate.slice(1));
        } else if (samePoint(chainEnd, candEnd)) {
          chain = chain.concat(candidate.slice(0, -1).reverse());
        } else if (samePoint(chainStart, candEnd)) {
          chain = candidate.slice(0, -1).concat(chain);
        } else if (samePoint(chainStart, candStart)) {
          chain = candidate.slice(1).reverse().concat(chain);
        } else {
          continue;
        }
        pool.splice(i, 1);
        extended = true;
        break;
      }
    }
    result.push(chain);
  }
  return result;
}

function perpendicularDistance(p: Position, a: Position, b: Position): number {
  const [x = NaN, y = NaN] = p;
  const [x1 = NaN, y1 = NaN] = a;
  const [x2 = NaN, y2 = NaN] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(x - px, y - py);
}

// Classic recursive Douglas-Peucker over an open path. Exported for reuse on
// transit line geometry (Task A5), which is dense enough (KRL: ~17k raw
// vertices) to blow the per-file size budget without simplification.
export function douglasPeucker(points: Position[], toleranceDeg: number): Position[] {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return points;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    if (!point) continue;
    const d = perpendicularDistance(point, first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > toleranceDeg) {
    const left = douglasPeucker(points.slice(0, index + 1), toleranceDeg);
    const right = douglasPeucker(points.slice(index), toleranceDeg);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

// Douglas-Peucker simplification for a closed ring (first point === last
// point). Splits the ring at the point farthest from the start, simplifies
// each half as an open path, then rejoins — plain DP would otherwise treat
// the coincident first/last points as a degenerate zero-length baseline.
export function simplifyRing(ring: Position[], toleranceDeg: number): Position[] {
  if (ring.length <= 3) return ring;
  const [first] = ring;
  if (!first) return ring;
  const [fx = NaN, fy = NaN] = first;
  const body = ring.slice(0, -1);
  let farIndex = 0;
  let farDist = -1;
  for (let i = 1; i < body.length; i++) {
    const point = body[i];
    if (!point) continue;
    const [px = NaN, py = NaN] = point;
    const d = Math.hypot(px - fx, py - fy);
    if (d > farDist) {
      farDist = d;
      farIndex = i;
    }
  }
  const chainA = douglasPeucker(body.slice(0, farIndex + 1), toleranceDeg);
  const chainB = douglasPeucker(body.slice(farIndex).concat([first]), toleranceDeg);
  const simplified = chainA.slice(0, -1).concat(chainB);
  // A valid ring needs at least 3 distinct positions plus the closing point.
  // A tolerance large enough to flatten everything below that would produce
  // a degenerate ring, so fall back to the original instead.
  return simplified.length >= 4 ? simplified : ring;
}

export interface FetchOsmArgs {
  source: string;
  only?: Set<string>;
  out?: string;
}

const FLAGS = new Set(['--source', '--only', '--out']);

// Parses `--source <file> [--only a,b] [--out dir]`. Throws (before any
// filesystem access) when `--source` is missing, or when any flag's value is
// missing or looks like another flag.
export function parseArgs(argv: string[]): FetchOsmArgs {
  let source: string | undefined;
  let only: Set<string> | undefined;
  let out: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === undefined || !FLAGS.has(flag)) continue;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${flag} requires a value`);
    }
    i++;
    if (flag === '--source') source = value;
    else if (flag === '--only') only = new Set(value.split(',').filter((s) => s.length > 0));
    else out = value;
  }
  if (!source) {
    throw new Error('usage: fetch-osm.ts --source data/sources/<x>.json [--only a,b] [--out dir]');
  }
  return { source, ...(only ? { only } : {}), ...(out ? { out } : {}) };
}

// Lowercases, strips diacritics, folds "jl."/"jalan" to one token and
// collapses whitespace — used to match road/station names across sources
// that spell them differently (Task A9 search index).
export function normaliseName(s: string): string {
  const stripped = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // "jl." is a token on its own even when jammed against the next word
  // (e.g. "Jl.Sudirman"), so consume any following whitespace too and always
  // re-insert exactly one space; the final collapse below cleans up runs.
  const withJalan = stripped.replace(/\bjl\.?\s*/g, 'jalan ');
  return withJalan.replace(/\s+/g, ' ').trim();
}
