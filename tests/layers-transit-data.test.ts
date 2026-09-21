import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FeatureCollection, Geometry } from 'geojson';
import type { TransitLineProps, TransitStationProps } from '../src/types';

type TransitProps = TransitLineProps | TransitStationProps;
type TransitFc = FeatureCollection<Geometry, TransitProps> & {
  properties: { data_as_of: string; source: string[] };
};

function load(id: string): TransitFc {
  return JSON.parse(readFileSync(`data/layers/${id}.geojson`, 'utf8')) as TransitFc;
}

function lines(fc: TransitFc): { properties: TransitLineProps }[] {
  return fc.features.filter((f) => f.geometry.type === 'MultiLineString') as {
    properties: TransitLineProps;
  }[];
}

function stations(fc: TransitFc): { properties: TransitStationProps }[] {
  return fc.features.filter((f) => f.geometry.type === 'Point') as {
    properties: TransitStationProps;
  }[];
}

const MAX_BYTES = 350_000;
const FILES = ['mrt', 'lrt', 'krl', 'transjakarta'] as const;

describe.each(FILES)('%s.geojson', (id) => {
  const fc = load(id);

  it(`is at most ${String(MAX_BYTES)} bytes`, () => {
    expect(statSync(`data/layers/${id}.geojson`).size).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('has a data_as_of date and the OSM source', () => {
    expect(fc.properties.data_as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fc.properties.source).toEqual(['https://www.openstreetmap.org/copyright']);
  });

  it('every line has a non-empty ref/name, a valid hex colour, and per-feature data_as_of', () => {
    for (const f of lines(fc)) {
      expect(f.properties.ref.length, JSON.stringify(f.properties)).toBeGreaterThan(0);
      expect(f.properties.name.length, JSON.stringify(f.properties)).toBeGreaterThan(0);
      expect(f.properties.colour).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(f.properties.data_as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('every station has a non-empty name', () => {
    for (const f of stations(fc)) {
      expect(f.properties.name.length).toBeGreaterThan(0);
    }
  });
});

describe('mrt.geojson', () => {
  const fc = load('mrt');
  it('has 1-2 lines (East-West Line is still proposed, excluded)', () => {
    expect(lines(fc).length).toBeGreaterThanOrEqual(1);
    expect(lines(fc).length).toBeLessThanOrEqual(2);
  });
  it('has 13-16 stations', () => {
    expect(stations(fc).length).toBeGreaterThanOrEqual(13);
    expect(stations(fc).length).toBeLessThanOrEqual(16);
  });
});

describe('lrt.geojson', () => {
  const fc = load('lrt');
  it('has 2-3 lines', () => {
    expect(lines(fc).length).toBeGreaterThanOrEqual(2);
    expect(lines(fc).length).toBeLessThanOrEqual(3);
  });
});

describe('krl.geojson', () => {
  const fc = load('krl');
  it('has at most 8 named lines (Review Focus 2)', () => {
    expect(lines(fc).length).toBeLessThanOrEqual(8);
  });
  it('has at least 40 stations', () => {
    expect(stations(fc).length).toBeGreaterThanOrEqual(40);
  });
});

describe('transjakarta.geojson', () => {
  const fc = load('transjakarta');
  it('has 10-16 corridors (Minitrans/Metrotrans feeders excluded)', () => {
    expect(lines(fc).length).toBeGreaterThanOrEqual(10);
    expect(lines(fc).length).toBeLessThanOrEqual(16);
  });
  it('every corridor ref is a plain 1-2 digit number', () => {
    for (const f of lines(fc)) {
      expect(f.properties.ref).toMatch(/^\d{1,2}$/);
    }
  });
});
