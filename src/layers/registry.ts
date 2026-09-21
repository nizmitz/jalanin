import { GAGE_COLORS } from '../gage-layer';
import type { LayerDef } from './types';

// Gage predates the generic layer system: src/gage-layer.ts renders it directly against the
// fixed 'gage-line'/'gage-casing' style layer ids, and main.ts toggles it by id rather than
// going through the manager. This entry exists only so the layer panel can list and toggle it
// alongside the real layers, first among the "rules" group. Its `data`/`layers` are unused
// stubs — main.ts filters 'gage' out of the set it hands to `createLayerManager().apply()`.
export const GAGE_PSEUDO: LayerDef = {
  id: 'gage',
  group: 'rules',
  labelKey: 'layerGage',
  defaultOn: true,
  data: { type: 'FeatureCollection', features: [] },
  layers: () => [],
  legend: [
    { colour: GAGE_COLORS.blocked, labelKey: 'statusAvoid' },
    { colour: GAGE_COLORS.open, labelKey: 'statusOk' },
  ],
};

export const LAYERS: readonly LayerDef[] = [GAGE_PSEUDO];

export function getLayerDef(id: string): LayerDef | undefined {
  return LAYERS.find((def) => def.id === id);
}
