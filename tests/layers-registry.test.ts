import { describe, expect, it } from 'vitest';
import { GAGE_PSEUDO, LAYERS, getLayerDef } from '../src/layers/registry';
import { layerIdHasPrefix } from '../src/layers/types';
import type { LayerDef } from '../src/layers/types';

describe('LAYERS', () => {
  it('has unique ids', () => {
    const ids = LAYERS.map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists the gage pseudo-entry first among rules', () => {
    const rules = LAYERS.filter((def) => def.group === 'rules');
    expect(rules[0]?.id).toBe('gage');
  });

  it('getLayerDef finds a known id and returns undefined for an unknown one', () => {
    expect(getLayerDef('gage')).toBe(GAGE_PSEUDO);
    expect(getLayerDef('does-not-exist')).toBeUndefined();
  });
});

describe('layerIdHasPrefix', () => {
  const synthetic: Pick<LayerDef, 'id'> = { id: 'mrt' };

  it('accepts a style layer id prefixed with the def id', () => {
    expect(layerIdHasPrefix(synthetic, 'mrt-line')).toBe(true);
  });

  it('rejects a style layer id that is not prefixed', () => {
    expect(layerIdHasPrefix(synthetic, 'krl-line')).toBe(false);
    expect(layerIdHasPrefix(synthetic, 'mrtline')).toBe(false);
  });
});
