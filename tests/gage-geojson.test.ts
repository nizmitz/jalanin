import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FeatureCollection, MultiLineString } from 'geojson';
import type { GageProps } from '../src/types';
import type { SourceFile } from '../scripts/lib';

const fc = JSON.parse(readFileSync('data/gage.geojson', 'utf8')) as FeatureCollection<
  MultiLineString,
  GageProps
> & { properties: { data_as_of: string; source: string[] } };
const source = JSON.parse(readFileSync('data/sources/gage.json', 'utf8')) as SourceFile;
const JKT = { minLon: 106.6, maxLon: 107.05, minLat: -6.45, maxLat: -6.05 };

describe('gage.geojson', () => {
  it('has 25 unique roads', () => {
    expect(fc.features).toHaveLength(25);
    expect(new Set(fc.features.map((f) => f.properties.id)).size).toBe(25);
  });
  it('every road has geometry inside Jakarta', () => {
    for (const f of fc.features) {
      expect(f.geometry.coordinates.length, f.properties.id).toBeGreaterThan(0);
      for (const line of f.geometry.coordinates)
        for (const [lon, lat] of line) {
          expect(lon, f.properties.id).toBeGreaterThan(JKT.minLon);
          expect(lon, f.properties.id).toBeLessThan(JKT.maxLon);
          expect(lat, f.properties.id).toBeGreaterThan(JKT.minLat);
          expect(lat, f.properties.id).toBeLessThan(JKT.maxLat);
        }
    }
  });
  it('clipped roads stay inside their clip bbox', () => {
    for (const s of source.items) {
      if (!s.clip) continue;
      const f = fc.features.find((x) => x.properties.id === s.id);
      expect(f, s.id).toBeDefined();
      for (const line of f?.geometry.coordinates ?? [])
        for (const [lon = NaN, lat = NaN] of line) {
          expect(lon, s.id).toBeGreaterThanOrEqual(s.clip[0]);
          expect(lon, s.id).toBeLessThanOrEqual(s.clip[2]);
          expect(lat, s.id).toBeGreaterThanOrEqual(s.clip[1]);
          expect(lat, s.id).toBeLessThanOrEqual(s.clip[3]);
        }
    }
  });
  it('file under 400 KB', () => {
    expect(readFileSync('data/gage.geojson').byteLength).toBeLessThan(400_000);
  });
  it('has a data_as_of date and a source list', () => {
    expect(fc.properties.data_as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fc.properties.source).toEqual(['https://www.openstreetmap.org/copyright']);
  });
});
