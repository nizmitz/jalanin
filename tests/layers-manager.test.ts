import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureCollection } from 'geojson';
import type { LayerSpecification } from 'maplibre-gl';
import type { LayerDef, LayerStyleSpec, MapLike, MapLikeStyleLayer } from '../src/layers/types';

const defs = new Map<string, LayerDef>();

vi.mock('../src/layers/registry', () => ({
  getLayerDef: (id: string): LayerDef | undefined => defs.get(id),
}));

vi.mock('../src/store', () => ({ getLang: () => 'id' as const }));

// Imported after the mocks above so createLayerManager picks them up.
const { createLayerManager } = await import('../src/layers/manager');

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };
const BASEMAP_LAYERS: MapLikeStyleLayer[] = [
  { id: 'building-fill', type: 'fill' },
  { id: 'place-label', type: 'symbol' },
];

interface FakeLayerRecord {
  id: string;
  source: string | undefined;
  before: string | undefined;
}

class FakeMap implements MapLike {
  sources = new Map<string, FeatureCollection>();
  layers: FakeLayerRecord[] = [];
  private styleLayers: MapLikeStyleLayer[] = BASEMAP_LAYERS;

  getSource(id: string) {
    if (!this.sources.has(id)) return undefined;
    return { setData: (data: FeatureCollection) => this.sources.set(id, data) };
  }
  addSource(id: string, source: { type: 'geojson'; data: FeatureCollection }) {
    this.sources.set(id, source.data);
  }
  removeSource(id: string) {
    this.sources.delete(id);
  }
  getLayer(id: string) {
    return this.layers.find((l) => l.id === id);
  }
  addLayer(layer: LayerSpecification, beforeId?: string) {
    const source = 'source' in layer ? layer.source : undefined;
    this.layers.push({ id: layer.id, source, before: beforeId });
  }
  removeLayer(id: string) {
    this.layers = this.layers.filter((l) => l.id !== id);
  }
  getStyle() {
    return { layers: this.styleLayers };
  }
  setLayoutProperty() {
    // not exercised by these tests
  }
  setFilter() {
    // not exercised by these tests
  }
  on() {
    // not exercised by these tests (no def under test declares a popup)
  }

  // Simulates map.setStyle() wiping every source/layer the manager had added, as happens on a
  // real style.load reset.
  resetStyle(): void {
    this.sources.clear();
    this.layers = [];
  }
}

// Defs never set `source` themselves — the manager injects `source: def.id` (Task A3 review
// item 2). `LayerStyleSpec` (LayerSpecification minus `source`) is exactly the type that keeps a
// def from doing so accidentally.
function makeDef(id: string, data: LayerDef['data']): LayerDef {
  return {
    id,
    group: 'transit',
    labelKey: 'layerMrt',
    defaultOn: true,
    data,
    layers: (): LayerStyleSpec[] => [{ id: `${id}-line`, type: 'line', paint: {} }],
  };
}

beforeEach(() => {
  defs.clear();
});

describe('createLayerManager', () => {
  it('apply({a,b}) adds 2 sources and inserts their layers before the first symbol layer', async () => {
    defs.set('a', makeDef('a', EMPTY_FC));
    defs.set('b', makeDef('b', EMPTY_FC));
    const map = new FakeMap();
    const manager = createLayerManager(map, () => 'light');

    await manager.apply(new Set(['a', 'b']));

    expect(map.sources.size).toBe(2);
    expect(map.layers).toEqual([
      { id: 'a-line', source: 'a', before: 'place-label' },
      { id: 'b-line', source: 'b', before: 'place-label' },
    ]);
  });

  it('injects source: def.id into a spec that has no source', async () => {
    defs.set('a', makeDef('a', EMPTY_FC));
    const map = new FakeMap();
    const manager = createLayerManager(map, () => 'light');

    await manager.apply(new Set(['a']));

    expect(map.getLayer('a-line')).toMatchObject({ source: 'a' });
  });

  it('disabling a layer removes its source and style layers', async () => {
    defs.set('a', makeDef('a', EMPTY_FC));
    defs.set('b', makeDef('b', EMPTY_FC));
    const map = new FakeMap();
    const manager = createLayerManager(map, () => 'light');
    await manager.apply(new Set(['a', 'b']));

    await manager.apply(new Set(['a']));

    expect(map.sources.has('b')).toBe(false);
    expect(map.getLayer('b-line')).toBeUndefined();
    expect(map.sources.has('a')).toBe(true);
  });

  it('onStyleLoad re-adds only what is currently enabled, not what was ever enabled (Review Focus 1)', async () => {
    defs.set('a', makeDef('a', EMPTY_FC));
    defs.set('b', makeDef('b', EMPTY_FC));
    const map = new FakeMap();
    const manager = createLayerManager(map, () => 'light');
    await manager.apply(new Set(['a', 'b']));
    await manager.apply(new Set(['a'])); // b turned off

    map.resetStyle(); // simulates the style.load reset wiping sources/layers
    await manager.onStyleLoad();

    expect(map.sources.has('a')).toBe(true);
    expect(map.sources.has('b')).toBe(false);
    expect(map.getLayer('a-line')).toBeDefined();
    expect(map.getLayer('b-line')).toBeUndefined();
  });

  it('awaits a lazy data thunk at most once, even across disable/re-enable', async () => {
    const thunk = vi.fn(() => Promise.resolve(EMPTY_FC));
    defs.set('a', makeDef('a', thunk));
    const map = new FakeMap();
    const manager = createLayerManager(map, () => 'light');

    await manager.apply(new Set(['a']));
    await manager.apply(new Set([])); // disable
    await manager.apply(new Set(['a'])); // re-enable

    expect(thunk).toHaveBeenCalledTimes(1);
    expect(map.sources.get('a')).toBe(EMPTY_FC);
  });

  it('does not resurrect a layer disabled again before its lazy data resolved', async () => {
    let resolveThunk!: (fc: FeatureCollection) => void;
    const pending = new Promise<FeatureCollection>((resolve) => {
      resolveThunk = resolve;
    });
    defs.set(
      'a',
      makeDef('a', () => pending),
    );
    const map = new FakeMap();
    const manager = createLayerManager(map, () => 'light');

    const applyA = manager.apply(new Set(['a'])); // starts, suspends awaiting `pending`
    await manager.apply(new Set([])); // disables 'a' again before its data resolves
    resolveThunk(EMPTY_FC);
    await applyA;

    expect(map.sources.has('a')).toBe(false);
    expect(map.getLayer('a-line')).toBeUndefined();

    map.resetStyle();
    await manager.onStyleLoad();

    expect(map.sources.has('a')).toBe(false);
    expect(map.getLayer('a-line')).toBeUndefined();
  });

  it('hideBasemapStations toggles visibility on layers matching /^(transit|pois)/', () => {
    const map = new FakeMap();
    const setLayoutProperty = vi.spyOn(map, 'setLayoutProperty');
    // Add a couple of matching/non-matching layers to the fake style.
    (map as unknown as { getStyle(): { layers: MapLikeStyleLayer[] } }).getStyle = () => ({
      layers: [
        { id: 'transit-station', type: 'symbol' },
        { id: 'pois-icon', type: 'symbol' },
        { id: 'building-fill', type: 'fill' },
      ],
    });
    const manager = createLayerManager(map, () => 'light');

    manager.hideBasemapStations(true);

    expect(setLayoutProperty).toHaveBeenCalledWith('transit-station', 'visibility', 'none');
    expect(setLayoutProperty).toHaveBeenCalledWith('pois-icon', 'visibility', 'none');
    expect(setLayoutProperty).not.toHaveBeenCalledWith('building-fill', 'visibility', 'none');
  });

  it('narrows a mixed-kind pois layer by filter instead of hiding it outright, and restores it', () => {
    const map = new FakeMap();
    const setFilter = vi.spyOn(map, 'setFilter');
    const setLayoutProperty = vi.spyOn(map, 'setLayoutProperty');
    const poisFilter = [
      'all',
      ['in', ['get', 'kind'], ['literal', ['park', 'station', 'bus_stop', 'restaurant']]],
    ];
    (map as unknown as { getStyle(): { layers: MapLikeStyleLayer[] } }).getStyle = () => ({
      layers: [{ id: 'pois', type: 'symbol', filter: poisFilter }],
    });
    const manager = createLayerManager(map, () => 'light');

    manager.hideBasemapStations(true);
    expect(setLayoutProperty).not.toHaveBeenCalled();
    expect(setFilter).toHaveBeenCalledWith('pois', [
      'all',
      ['in', ['get', 'kind'], ['literal', ['park', 'restaurant']]],
    ]);

    manager.hideBasemapStations(false);
    expect(setFilter).toHaveBeenLastCalledWith('pois', poisFilter);
  });

  it('applies a per-layer aboveLabels predicate instead of the def-wide flag', async () => {
    defs.set('a', {
      id: 'a',
      group: 'transit',
      labelKey: 'layerMrt',
      defaultOn: true,
      data: EMPTY_FC,
      layers: (): LayerStyleSpec[] => [
        { id: 'a-line', type: 'line', paint: {} },
        { id: 'a-label', type: 'symbol', layout: {} },
      ],
      aboveLabels: (layerId) => layerId === 'a-label',
    });
    const map = new FakeMap();
    const manager = createLayerManager(map, () => 'light');

    await manager.apply(new Set(['a']));

    expect(map.getLayer('a-line')).toMatchObject({ before: 'place-label' });
    expect(map.getLayer('a-label')).toMatchObject({ before: undefined });
  });
});
