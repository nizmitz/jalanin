import type { Feature, FeatureCollection, GeoJsonProperties } from 'geojson';
import type { ExpressionSpecification } from 'maplibre-gl';
import mrtRaw from '../../data/layers/mrt.geojson?raw';
import lrtRaw from '../../data/layers/lrt.geojson?raw';
import krlRaw from '../../data/layers/krl.geojson?raw';
import transjakartaRaw from '../../data/layers/transjakarta.geojson?raw';
import { escapeHtml } from '../html';
import type { StringKey } from '../i18n';
import type { Theme } from '../theme';
import type { TransitLineProps, TransitStationProps } from '../types';
import type { LayerDef, LayerStyleSpec, LegendEntry } from './types';

type TransitId = 'mrt' | 'lrt' | 'krl' | 'transjakarta';

const DEFAULT_ON: Record<TransitId, boolean> = {
  mrt: true,
  lrt: true,
  krl: true,
  transjakarta: false,
};

// Line/station colours come from the data; only the casing and station fill follow the theme.
const CASING: Record<Theme, string> = { light: '#ffffff', dark: '#000000' };
const STATION_FILL: Record<Theme, string> = { light: '#ffffff', dark: '#141414' };
const HALO: Record<Theme, string> = { light: '#ffffff', dark: '#1e1d1a' };

function isLine(f: Feature): f is Feature<Feature['geometry'], TransitLineProps> {
  return f.geometry.type === 'MultiLineString' || f.geometry.type === 'LineString';
}

function lineFeatures(data: FeatureCollection): Feature<Feature['geometry'], TransitLineProps>[] {
  return data.features.filter(isLine);
}

function isStationProps(p: GeoJsonProperties): p is TransitStationProps {
  return p !== null && Array.isArray((p as { lines?: unknown }).lines);
}

export function transitDef(id: TransitId, labelKey: StringKey, data: FeatureCollection): LayerDef {
  const lines = lineFeatures(data);
  const first = lines[0];
  const defaultColour = first ? first.properties.colour : '#6B7A8F';
  const colourByRef = new Map(lines.map((f) => [f.properties.ref, f.properties.colour]));

  const legend: LegendEntry[] =
    id === 'transjakarta'
      ? [{ colour: defaultColour, label: 'Koridor 1–14' }]
      : lines.map((f) => ({
          colour: f.properties.colour,
          label: `${f.properties.ref} ${f.properties.name}`,
        }));

  function layers(theme: Theme): LayerStyleSpec[] {
    const lineFilter: ExpressionSpecification = [
      'match',
      ['geometry-type'],
      ['LineString', 'MultiLineString'],
      true,
      false,
    ];
    const pointFilter: ExpressionSpecification = ['==', ['geometry-type'], 'Point'];
    const specs: LayerStyleSpec[] = [
      {
        id: `${id}-casing`,
        type: 'line',
        filter: lineFilter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': CASING[theme],
          'line-opacity': 0.6,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 8],
        },
      },
      {
        id: `${id}-line`,
        type: 'line',
        filter: lineFilter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'colour'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 15, 5],
        },
      },
      {
        id: `${id}-station`,
        type: 'circle',
        filter: pointFilter,
        paint: {
          'circle-color': STATION_FILL[theme],
          'circle-stroke-color': ['coalesce', ['get', 'colour'], defaultColour],
          'circle-stroke-width': 2,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 6],
        },
      },
      {
        id: `${id}-label`,
        type: 'symbol',
        filter: pointFilter,
        minzoom: 13,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Medium'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 11, 16, 13],
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': theme === 'dark' ? '#F2EFE8' : '#141414',
          'text-halo-color': HALO[theme],
          'text-halo-width': 1.5,
        },
      },
    ];
    return specs;
  }

  function popup(props: GeoJsonProperties): string {
    if (isStationProps(props)) {
      const chips = props.lines
        .map((ref) => {
          const colour = colourByRef.get(ref) ?? defaultColour;
          return `<span class="chip" style="background:${escapeHtml(colour)}">${escapeHtml(ref)}</span>`;
        })
        .join('');
      return `<b>${escapeHtml(props.name)}</b><br>${chips}<br><small>${escapeHtml(props.network)}</small>`;
    }
    const p = props as Partial<TransitLineProps> | null;
    const ref = p?.ref ?? '';
    const name = p?.name ?? '';
    const network = p?.network ?? '';
    return `<b>${escapeHtml(ref)}</b> · ${escapeHtml(name)}<br><small>${escapeHtml(network)}</small>`;
  }

  return {
    id,
    group: 'transit',
    labelKey,
    defaultOn: DEFAULT_ON[id],
    data,
    layers,
    aboveLabels: (layerId) => layerId === `${id}-label`,
    popup,
    legend,
  };
}

function parse(raw: string): FeatureCollection {
  return JSON.parse(raw) as FeatureCollection;
}

export const MRT = transitDef('mrt', 'layerMrt', parse(mrtRaw));
export const LRT = transitDef('lrt', 'layerLrt', parse(lrtRaw));
export const KRL = transitDef('krl', 'layerKrl', parse(krlRaw));
export const TRANSJAKARTA = transitDef('transjakarta', 'layerTransjakarta', parse(transjakartaRaw));
export const TRANSIT_IDS: readonly TransitId[] = ['mrt', 'lrt', 'krl', 'transjakarta'];
