import type { Position } from 'geojson';

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
