import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import { getLang } from '../store';
import type { Theme } from '../theme';
import { getLayerDef } from './registry';
import { layerIdHasPrefix } from './types';
import type { LayerDef, LayerStyleSpec, MapLike } from './types';

// Basemap layers that draw stations/POIs the transit layers will replace (Task A6). Matched by
// id prefix rather than a fixed list since the exact protomaps layer ids can shift with the
// basemap version. Probed against @protomaps/basemaps 5.7.2 (`layers('protomaps',
// namedFlavor('light'), {lang:'id'})`): the only match is a single combined `pois` symbol layer
// whose `kind` filter mixes `station`/`bus_stop` in with parks, restaurants, universities, etc.
// (there is no separate `transit_*` layer in this basemap version) — hiding it outright would
// remove those unrelated POIs too, hence the filter-narrowing path below rather than a blanket
// visibility toggle. The regex stays broad for forward-compat with basemap versions that do ship
// dedicated transit/station layers.
const BASEMAP_STATION_LAYERS = /^(transit|pois)/;

// `kind` values that mean "this feature is a transit station" in the protomaps POI schema.
const STATION_KINDS = new Set(['station', 'bus_stop']);

// Finds the first `["literal", [...strings]]` node in a filter expression tree — that's where a
// protomaps `["in", ["get","kind"], ["literal",[...]]]` filter keeps its kind list.
function findKindLiteral(node: unknown): string[] | null {
  if (!Array.isArray(node)) return null;
  if (
    node[0] === 'literal' &&
    Array.isArray(node[1]) &&
    node[1].every((v) => typeof v === 'string')
  ) {
    return node[1];
  }
  for (const child of node) {
    const found = findKindLiteral(child);
    if (found) return found;
  }
  return null;
}

// Deep-clones a filter expression with every kind literal's station/bus_stop entries removed, so
// the rest of the layer (parks, restaurants, ...) keeps rendering.
function excludeStationKinds(filter: unknown): unknown {
  if (!Array.isArray(filter)) return filter;
  if (
    filter[0] === 'literal' &&
    Array.isArray(filter[1]) &&
    filter[1].every((v) => typeof v === 'string')
  ) {
    return ['literal', filter[1].filter((v) => !STATION_KINDS.has(v))];
  }
  return filter.map(excludeStationKinds);
}

// Defs never name their own source (see LayerStyleSpec) — the manager is the single place that
// decides it, always `def.id`, so a layer and its source can never accidentally mismatch.
function withSource(def: LayerDef, spec: LayerStyleSpec): LayerSpecification {
  if ('source' in spec) return spec as LayerSpecification;
  return { ...spec, source: def.id } as LayerSpecification;
}

export interface LayerManager {
  apply(enabled: ReadonlySet<string>): Promise<void>;
  onStyleLoad(): Promise<void>;
  hideBasemapStations(on: boolean): void;
}

export function createLayerManager(map: MapLike, theme: () => Theme): LayerManager {
  // Data is cached forever once resolved: a lazy thunk is awaited at most once per layer id, even
  // across disable/re-enable and style reloads.
  const dataCache = new Map<string, FeatureCollection | Promise<FeatureCollection>>();
  // Wired once per (map, layer id) pair, independent of how many times style.load re-adds the
  // underlying style layers.
  const popupWired = new WeakMap<MapLike, Set<string>>();
  let currentEnabled: ReadonlySet<string> = new Set();
  // The most recently *requested* set, recorded synchronously before any await. addDef() checks
  // this after every await so a layer that was disabled again while its data was still loading
  // never gets added — see apply() below.
  let latestEnabled: ReadonlySet<string> = new Set();

  async function resolveData(def: LayerDef): Promise<FeatureCollection> {
    const cached = dataCache.get(def.id);
    if (cached !== undefined) return cached instanceof Promise ? await cached : cached;
    if (typeof def.data === 'function') {
      const pending = def.data();
      dataCache.set(def.id, pending);
      const resolved = await pending;
      dataCache.set(def.id, resolved);
      return resolved;
    }
    dataCache.set(def.id, def.data);
    return def.data;
  }

  function isAboveLabels(def: LayerDef, layerId: string): boolean {
    return typeof def.aboveLabels === 'function'
      ? def.aboveLabels(layerId)
      : Boolean(def.aboveLabels);
  }

  function beforeLayerId(def: LayerDef, layerId: string): string | undefined {
    if (isAboveLabels(def, layerId)) return undefined;
    return map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  }

  function preparedSpecs(def: LayerDef): LayerSpecification[] {
    const specs = def.layers(theme()).map((spec) => withSource(def, spec));
    for (const spec of specs) {
      if (layerIdHasPrefix(def, spec.id)) continue;
      const message = `layer "${spec.id}" from LayerDef "${def.id}" must be prefixed "${def.id}-"`;
      if (import.meta.env.DEV) throw new Error(message);
      console.error(message);
    }
    return specs;
  }

  function wirePopup(def: LayerDef, specs: LayerSpecification[]): void {
    if (!def.popup) return;
    let wired = popupWired.get(map);
    if (!wired) {
      wired = new Set();
      popupWired.set(map, wired);
    }
    if (wired.has(def.id)) return;
    wired.add(def.id);
    const popup = def.popup;
    for (const spec of specs) {
      map.on('click', spec.id, (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(popup(feature.properties, getLang()))
          .addTo(map as unknown as maplibregl.Map);
      });
    }
  }

  async function addDef(def: LayerDef): Promise<void> {
    const data = await resolveData(def);
    // A later apply() call may have disabled this layer again while its data was still
    // resolving; respect the latest request rather than the one that started this add.
    if (!latestEnabled.has(def.id)) return;
    if (!map.getSource(def.id)) {
      map.addSource(def.id, { type: 'geojson', data });
    }
    const specs = preparedSpecs(def);
    for (const spec of specs) {
      if (!map.getLayer(spec.id)) map.addLayer(spec, beforeLayerId(def, spec.id));
    }
    wirePopup(def, specs);
  }

  function removeDef(def: LayerDef): void {
    for (const spec of preparedSpecs(def)) {
      if (map.getLayer(spec.id)) map.removeLayer(spec.id);
    }
    if (map.getSource(def.id)) map.removeSource(def.id);
  }

  async function apply(enabled: ReadonlySet<string>): Promise<void> {
    // Recorded before any await below so a concurrent, later apply() call can tell an in-flight
    // addDef() that it's now stale (see the check in addDef above).
    latestEnabled = enabled;
    const toRemove = [...currentEnabled].filter((id) => !enabled.has(id));
    const toAdd = [...enabled].filter((id) => !currentEnabled.has(id));
    for (const id of toRemove) {
      const def = getLayerDef(id);
      if (def) removeDef(def);
    }
    for (const id of toAdd) {
      const def = getLayerDef(id);
      if (def) await addDef(def);
    }
    // Not `enabled`: a later apply() may have superseded this call while the loop above was
    // awaiting, and `latestEnabled` is the only place that still reflects it.
    currentEnabled = new Set(latestEnabled);
  }

  async function onStyleLoad(): Promise<void> {
    // style.load wipes every source/layer the manager added; re-apply whatever was enabled
    // before the reset. A layer the user had turned off must stay off (Review Focus 1), so this
    // must never fall back to the registry's defaultOn set.
    const enabled = currentEnabled;
    currentEnabled = new Set();
    await apply(enabled);
  }

  // Captured lazily the first time hideBasemapStations touches a mixed-kind layer (e.g. `pois`),
  // so the filter can be restored exactly rather than re-derived.
  const originalFilters = new Map<string, unknown>();
  let loggedIds = false;

  function hideBasemapStations(on: boolean): void {
    const matched: string[] = [];
    for (const layer of map.getStyle().layers) {
      if (!BASEMAP_STATION_LAYERS.test(layer.id)) continue;
      matched.push(layer.id);
      const kinds = findKindLiteral(layer.filter);
      const isMixedKindLayer = kinds !== null && kinds.some((k) => !STATION_KINDS.has(k));
      if (isMixedKindLayer) {
        // e.g. protomaps' single `pois` layer: narrow its filter instead of hiding it outright,
        // so unrelated POIs (parks, restaurants, ...) it also draws stay visible.
        if (!originalFilters.has(layer.id)) originalFilters.set(layer.id, layer.filter);
        const original = originalFilters.get(layer.id);
        map.setFilter(layer.id, on ? excludeStationKinds(original) : original);
      } else {
        map.setLayoutProperty(layer.id, 'visibility', on ? 'none' : 'visible');
      }
    }
    if (on && import.meta.env.DEV && !loggedIds) {
      loggedIds = true;
      console.log('[jalanin] hiding basemap station layers:', matched);
    }
  }

  return { apply, onStyleLoad, hideBasemapStations };
}
