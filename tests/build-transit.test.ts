import { describe, expect, it } from 'vitest';
import {
  isOperational,
  masterRef,
  stationKey,
  stationRank,
  toHexColour,
} from '../scripts/build-transit.ts';

describe('toHexColour', () => {
  it('normalises a valid hex to uppercase', () => {
    expect(toHexColour('#ec2329', '#000000')).toBe('#EC2329');
  });
  it('passes through an already-uppercase hex', () => {
    expect(toHexColour('#EC2329', '#000000')).toBe('#EC2329');
  });
  it('maps known CSS colour names case-insensitively', () => {
    expect(toHexColour('blue', '#000000')).toBe('#0000FF');
    expect(toHexColour('Pink', '#000000')).toBe('#FFC0CB');
    expect(toHexColour('BROWN', '#000000')).toBe('#A52A2A');
  });
  it('falls back for an unknown name or missing value', () => {
    expect(toHexColour('mauve', '#123456')).toBe('#123456');
    expect(toHexColour(undefined, '#123456')).toBe('#123456');
    expect(toHexColour('', '#123456')).toBe('#123456');
  });
});

describe('masterRef', () => {
  it('uses tags.ref when present', () => {
    expect(masterRef({ ref: 'M', name: 'MRT North-South Line' })).toBe('M');
  });
  it('trims a ref with surrounding whitespace', () => {
    expect(masterRef({ ref: ' 7 ', name: 'x' })).toBe('7');
  });
  it('derives the trailing number from the name when ref is missing', () => {
    expect(masterRef({ name: 'Transjakarta BRT 2' })).toBe('2');
    expect(masterRef({ name: 'Transjakarta BRT 13' })).toBe('13');
  });
  it('returns undefined when neither ref nor a trailing number is available', () => {
    expect(masterRef({ name: 'LRT Jakarta' })).toBeUndefined();
    expect(masterRef(undefined)).toBeUndefined();
  });
});

describe('isOperational', () => {
  it('is true when tags are absent or carry no lifecycle markers', () => {
    expect(isOperational(undefined)).toBe(true);
    expect(isOperational({ name: 'x', route: 'subway' })).toBe(true);
  });
  it('is false for a proposed:* prefixed key (MRT East-West Line pattern)', () => {
    expect(isOperational({ name: 'x', 'proposed:railway': 'subway' })).toBe(false);
  });
  it('is false for construction/disused markers', () => {
    expect(isOperational({ construction: 'subway' })).toBe(false);
    expect(isOperational({ disused: 'yes' })).toBe(false);
    expect(isOperational({ 'construction:railway': 'subway' })).toBe(false);
    expect(isOperational({ 'disused:railway': 'subway' })).toBe(false);
  });
  it('is false for a non-operational state, true for open/operational', () => {
    expect(isOperational({ state: 'proposed' })).toBe(false);
    expect(isOperational({ state: 'operational' })).toBe(true);
    expect(isOperational({ state: 'open' })).toBe(true);
  });
});

describe('stationRank', () => {
  it('has no rank without a name tag', () => {
    expect(stationRank({ public_transport: 'station' }, 'mrt')).toBe(-1);
  });
  it('ranks public_transport=station best for rail networks', () => {
    expect(stationRank({ name: 'Palmerah', public_transport: 'station' }, 'krl')).toBe(0);
  });
  it('ranks railway=station|halt second', () => {
    expect(stationRank({ name: 'x', railway: 'station' }, 'krl')).toBe(1);
    expect(stationRank({ name: 'x', railway: 'halt' }, 'krl')).toBe(1);
  });
  it('ranks a mode-tagged stop_position third', () => {
    expect(stationRank({ name: 'x', public_transport: 'stop_position', train: 'yes' }, 'krl')).toBe(
      2,
    );
    expect(
      stationRank({ name: 'x', public_transport: 'stop_position', subway: 'yes' }, 'mrt'),
    ).toBe(2);
    expect(
      stationRank({ name: 'x', public_transport: 'stop_position', light_rail: 'yes' }, 'lrt'),
    ).toBe(2);
  });
  it('rejects a stop_position without the mode tag', () => {
    expect(stationRank({ name: 'x', public_transport: 'stop_position' }, 'krl')).toBe(-1);
  });
  it('uses the Transjakarta halte rule instead of the rail rules', () => {
    expect(stationRank({ name: 'x', highway: 'bus_stop' }, 'transjakarta')).toBe(0);
    expect(stationRank({ name: 'x', public_transport: 'platform' }, 'transjakarta')).toBe(0);
    expect(
      stationRank({ name: 'x', public_transport: 'stop_position', train: 'yes' }, 'transjakarta'),
    ).toBe(-1);
    expect(stationRank({ name: 'x', public_transport: 'station' }, 'transjakarta')).toBe(-1);
  });
});

describe('stationKey', () => {
  it('reuses the key for a same-name node within 600 m and separates distant namesakes', () => {
    const best = new Map<string, { lon: number; lat: number }>();
    const k1 = stationKey('Sudirman', 106.8228, -6.2025, best);
    best.set(k1, { lon: 106.8228, lat: -6.2025 });
    expect(stationKey('sudirman', 106.823, -6.2027, best)).toBe(k1);
    const k2 = stationKey('Sudirman', 106.9, -6.3, best);
    expect(k2).not.toBe(k1);
    best.set(k2, { lon: 106.9, lat: -6.3 });
    expect(stationKey('Sudirman', 106.9001, -6.3001, best)).toBe(k2);
  });
});
