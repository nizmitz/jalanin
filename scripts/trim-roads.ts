import { readFileSync, writeFileSync } from 'node:fs';
import type { Feature, FeatureCollection, MultiLineString, Position } from 'geojson';
import type { GageProps } from '../src/types.ts';
import { clipLine, type Bbox, type OverpassResponse } from './lib.ts';

interface Seg {
  id: string;
  name: string;
  group: GageProps['group'];
  note?: string;
  clip?: Bbox;
}

const segs = JSON.parse(readFileSync('data/segments.json', 'utf8')) as Seg[];
const r6 = (n: number): number => Math.round(n * 1e6) / 1e6;

function extent(lines: Position[][]): {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
} {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const line of lines) {
    for (const [lon = NaN, lat = NaN] of line) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLon, maxLon, minLat, maxLat };
}

const CLIPPED_IDS = new Set(['fatmawati', 's-parman', 'a-yani', 'salemba-raya']);

const features: Feature<MultiLineString, GageProps>[] = segs.map((s) => {
  const raw = JSON.parse(readFileSync(`data/raw/${s.id}.json`, 'utf8')) as OverpassResponse;
  const rawLines: Position[][] = raw.elements.map((w) =>
    w.geometry.map((p) => [r6(p.lon), r6(p.lat)] as Position),
  );

  const lines: Position[][] = rawLines.flatMap((line) => clipLine(line, s.clip));

  if (lines.length === 0) throw new Error(`${s.id}: no ways after clip`);

  if (CLIPPED_IDS.has(s.id)) {
    const rawExt = extent(rawLines);
    const clippedExt = extent(lines);
    console.log(
      `${s.id}: raw ways=${String(rawLines.length)} extent lon[${rawExt.minLon.toFixed(6)},${rawExt.maxLon.toFixed(6)}] lat[${rawExt.minLat.toFixed(6)},${rawExt.maxLat.toFixed(6)}]`,
    );
    console.log(
      `${s.id}: clipped ways=${String(lines.length)} extent lon[${clippedExt.minLon.toFixed(6)},${clippedExt.maxLon.toFixed(6)}] lat[${clippedExt.minLat.toFixed(6)},${clippedExt.maxLat.toFixed(6)}]`,
    );
  }

  const properties: GageProps = {
    id: s.id,
    name: s.name,
    group: s.group,
    ...(s.note ? { note: s.note } : {}),
  };
  return { type: 'Feature', properties, geometry: { type: 'MultiLineString', coordinates: lines } };
});

const fc: FeatureCollection<MultiLineString, GageProps> = { type: 'FeatureCollection', features };
writeFileSync('data/gage.geojson', JSON.stringify(fc));
console.log(`wrote ${String(features.length)} roads`);
