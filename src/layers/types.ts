import type { Feature, FeatureCollection, GeoJsonProperties } from 'geojson';
import type { DistributiveOmit, LayerSpecification } from 'maplibre-gl';
import type { Lang, StringKey } from '../i18n';
import type { Theme } from '../theme';

export type LayerGroup = 'rules' | 'transit' | 'road' | 'hazard';

// Either `labelKey` (a translated string) or a literal `label` (for text that isn't a fixed
// StringKey, e.g. a line's own `${ref} ${name}` built from data). Exactly one is expected to be
// set; `label` wins if both are.
export interface LegendEntry {
  colour: string;
  labelKey?: StringKey;
  label?: string;
  dashed?: boolean;
}

// What a LayerDef hands the manager per style layer: everything a LayerSpecification needs
// except `source` — the manager always injects `source: def.id` (see manager.ts), so defs never
// name (or mis-name) their own source.
export type LayerStyleSpec = DistributiveOmit<LayerSpecification, 'source'>;

export interface LayerDef {
  id: string;
  group: LayerGroup;
  labelKey: StringKey;
  defaultOn: boolean;
  // A thunk is awaited lazily (once, cached) by the manager instead of bundling every layer's
  // data into the main chunk up front.
  data: FeatureCollection | (() => Promise<FeatureCollection>);
  // Style layer ids must be prefixed `${id}-`; the manager validates the prefix at apply time.
  layers: (theme: Theme) => LayerStyleSpec[];
  // Symbol layers that should sit above basemap labels instead of below them. A plain boolean
  // applies to every style layer the def emits; a predicate lets a def put some of its layers
  // (e.g. station labels) above while keeping others (lines, station dots) below.
  aboveLabels?: boolean | ((layerId: string) => boolean);
  popup?: (props: GeoJsonProperties, lang: Lang) => string;
  legend?: LegendEntry[];
  searchable?: (feature: Feature) => { name: string; sub?: string } | null;
}

export function layerIdHasPrefix(def: Pick<LayerDef, 'id'>, layerId: string): boolean {
  return layerId.startsWith(`${def.id}-`);
}

export interface MapLikeSource {
  setData(data: FeatureCollection): unknown;
}

export interface MapLikeClickEvent {
  features?: { properties: GeoJsonProperties }[];
  lngLat: { lng: number; lat: number };
}

export interface MapLikeStyleLayer {
  id: string;
  type: string;
  // Present on basemap layers whose visibility hideBasemapStations() may need to narrow rather
  // than toggle outright (see manager.ts) — untyped because its shape is a MapLibre filter
  // expression, not something this module needs to validate.
  filter?: unknown;
}

// Minimal subset of maplibregl.Map the layer manager touches — loose enough to satisfy with a
// hand-written fake in tests. A real maplibregl.Map is cast to this shape at the call site
// (main.ts) rather than made to structurally satisfy it, since Map's own return types (e.g.
// getSource) are broader than what the manager actually uses.
export interface MapLike {
  getSource(id: string): MapLikeSource | undefined;
  addSource(id: string, source: { type: 'geojson'; data: FeatureCollection }): unknown;
  removeSource(id: string): unknown;
  getLayer(id: string): unknown;
  addLayer(layer: LayerSpecification, beforeId?: string): unknown;
  removeLayer(id: string): unknown;
  getStyle(): { layers: readonly MapLikeStyleLayer[] };
  setLayoutProperty(layerId: string, name: string, value: unknown): unknown;
  setFilter(layerId: string, filter: unknown): unknown;
  on(type: 'click', layerId: string, listener: (ev: MapLikeClickEvent) => void): unknown;
}
