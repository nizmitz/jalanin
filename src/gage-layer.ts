import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection, MultiLineString } from 'geojson';
import gageRaw from '../data/gage.geojson?raw';
import type { Verdict } from './gage';
import type { Theme } from './theme';
import type { GageProps } from './types';

const gage = JSON.parse(gageRaw) as FeatureCollection<MultiLineString, GageProps>;

export type RoadState = 'blocked' | 'blocked-later' | 'open';

export const GAGE_COLORS: Record<RoadState, string> = {
  blocked: '#E03A2F',
  'blocked-later': '#E0951C',
  open: '#6B7A8F',
};

// Casing sits under the coloured line so it stays legible on both basemaps.
export const CASING_COLORS: Record<Theme, string> = { light: '#ffffff', dark: '#000000' };

export function roadState(v: Verdict, activeNow: boolean): RoadState {
  if (v !== 'avoid') return 'open';
  return activeNow ? 'blocked' : 'blocked-later';
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstSymbolLayerId(map: maplibregl.Map): string | undefined {
  return map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
}

// One popup handler per map, even though layers are re-added on every style.load.
const wired = new WeakSet<maplibregl.Map>();

function wirePopup(map: maplibregl.Map): void {
  if (wired.has(map)) return;
  wired.add(map);
  map.on('click', 'gage-line', (e) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const props = feature.properties as GageProps;
    const note = props.note ? `<br>${escapeHtml(props.note)}` : '';
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<b>${escapeHtml(props.name)}</b>${note}`)
      .addTo(map);
  });
}

export function addGageLayers(map: maplibregl.Map, state: RoadState, theme: Theme): void {
  const beforeId = firstSymbolLayerId(map);

  if (!map.getSource('gage')) {
    map.addSource('gage', { type: 'geojson', data: gage });
  }

  if (!map.getLayer('gage-casing')) {
    map.addLayer(
      {
        id: 'gage-casing',
        type: 'line',
        source: 'gage',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': CASING_COLORS[theme],
          'line-opacity': 0.35,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 10],
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer('gage-line')) {
    map.addLayer(
      {
        id: 'gage-line',
        type: 'line',
        source: 'gage',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': GAGE_COLORS[state],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 16, 6],
        },
      },
      beforeId,
    );
  }

  wirePopup(map);
}

export function setGageState(map: maplibregl.Map, state: RoadState): void {
  if (map.getLayer('gage-line')) {
    map.setPaintProperty('gage-line', 'line-color', GAGE_COLORS[state]);
  }
}
