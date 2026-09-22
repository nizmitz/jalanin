import { describe, expect, it } from 'vitest';
import { KRL, LRT, MRT, TRANSJAKARTA, transitDef } from '../src/layers/transit';
import type { FeatureCollection } from 'geojson';

function fc(features: FeatureCollection['features']): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features,
    // Non-standard but read by the layer panel (see layers/panel.ts) and, here, by transitDef
    // itself for the station stroke's default colour.
    properties: { data_as_of: '2026-09-21', source: ['https://www.openstreetmap.org/copyright'] },
  } as unknown as FeatureCollection;
}

const TWO_LINE_DATA = fc([
  {
    type: 'Feature',
    geometry: {
      type: 'MultiLineString',
      coordinates: [
        [
          [106.8, -6.2],
          [106.81, -6.21],
        ],
      ],
    },
    properties: {
      ref: 'M',
      name: 'MRT North-South Line',
      colour: '#CE0037',
      network: 'MRT Jakarta',
      operator: 'MRT Jakarta',
      data_as_of: '2026-09-21',
    },
  },
  {
    type: 'Feature',
    geometry: {
      type: 'MultiLineString',
      coordinates: [
        [
          [106.9, -6.3],
          [106.91, -6.31],
        ],
      ],
    },
    properties: {
      ref: 'E',
      name: 'MRT East-West Line',
      colour: '#00A650',
      network: 'MRT Jakarta',
      operator: 'MRT Jakarta',
      data_as_of: '2026-09-21',
    },
  },
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [106.8, -6.2] },
    properties: { name: '<Evil> Station', network: 'MRT Jakarta', lines: ['M'] },
  },
]);

describe('transitDef', () => {
  it('prefixes every style layer id with the def id', () => {
    const def = transitDef('mrt', 'layerMrt', TWO_LINE_DATA);
    for (const spec of def.layers('light')) {
      expect(spec.id.startsWith('mrt-')).toBe(true);
    }
  });

  it('orders style layers casing, line, station, label', () => {
    const def = transitDef('mrt', 'layerMrt', TWO_LINE_DATA);
    const ids = def.layers('light').map((s) => s.id);
    expect(ids).toEqual(['mrt-casing', 'mrt-line', 'mrt-station', 'mrt-label']);
  });

  it('sets defaultOn per id: mrt/lrt/krl true, transjakarta false', () => {
    expect(transitDef('mrt', 'layerMrt', TWO_LINE_DATA).defaultOn).toBe(true);
    expect(transitDef('lrt', 'layerLrt', TWO_LINE_DATA).defaultOn).toBe(true);
    expect(transitDef('krl', 'layerKrl', TWO_LINE_DATA).defaultOn).toBe(true);
    expect(transitDef('transjakarta', 'layerTransjakarta', TWO_LINE_DATA).defaultOn).toBe(false);
  });

  it('station circle stroke colour falls back to the first line feature colour', () => {
    const def = transitDef('mrt', 'layerMrt', TWO_LINE_DATA);
    const station = def.layers('light').find((s) => s.id === 'mrt-station');
    expect(station?.type).toBe('circle');
    const stroke = (station as { paint?: Record<string, unknown> }).paint?.['circle-stroke-color'];
    // ['coalesce', ['get', 'colour'], '#CE0037'] — the first line's colour, since stations don't
    // carry their own `colour` property.
    expect(stroke).toEqual(['coalesce', ['get', 'colour'], '#CE0037']);
  });

  it('assigns group transit', () => {
    expect(transitDef('mrt', 'layerMrt', TWO_LINE_DATA).group).toBe('transit');
  });

  it('legend has one entry per line, except transjakarta which gets a single "Koridor 1-14" entry', () => {
    const mrt = transitDef('mrt', 'layerMrt', TWO_LINE_DATA);
    expect(mrt.legend).toHaveLength(2);

    const tj = transitDef('transjakarta', 'layerTransjakarta', TWO_LINE_DATA);
    expect(tj.legend).toHaveLength(1);
  });

  it('the label layer sits above basemap labels, other layers do not', () => {
    const def = transitDef('mrt', 'layerMrt', TWO_LINE_DATA);
    expect(typeof def.aboveLabels).toBe('function');
    const above = def.aboveLabels as (id: string) => boolean;
    expect(above('mrt-label')).toBe(true);
    expect(above('mrt-casing')).toBe(false);
    expect(above('mrt-line')).toBe(false);
    expect(above('mrt-station')).toBe(false);
  });

  describe('popup', () => {
    it('escapes < in a line feature name', () => {
      const def = transitDef('mrt', 'layerMrt', TWO_LINE_DATA);
      const html = def.popup?.(
        {
          ref: 'M',
          name: '<script>alert(1)</script>',
          colour: '#CE0037',
          network: 'MRT Jakarta',
          data_as_of: '2026-09-21',
        },
        'id',
      );
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes < in a station feature name and includes a chip per line', () => {
      const def = transitDef('mrt', 'layerMrt', TWO_LINE_DATA);
      const html = def.popup?.(
        { name: '<Evil> Station', network: 'MRT Jakarta', lines: ['M'] },
        'id',
      );
      expect(html).not.toContain('<Evil>');
      expect(html).toContain('&lt;Evil&gt; Station');
      expect(html).toContain('class="chip"');
      expect(html).toContain('background:#CE0037');
      expect(html).toContain('>M<');
    });
  });
});

describe('MRT/LRT/KRL/TRANSJAKARTA registry defs', () => {
  it('are exported with the expected ids', () => {
    expect(MRT.id).toBe('mrt');
    expect(LRT.id).toBe('lrt');
    expect(KRL.id).toBe('krl');
    expect(TRANSJAKARTA.id).toBe('transjakarta');
  });
});
