import { describe, expect, it } from 'vitest';
import { bearingForFollow, circlePolygon, distanceM } from '../src/geo';
import type { Fix } from '../src/geo';

function fix(partial: Partial<Fix>): Fix {
  return { lon: 106.82, lat: -6.2, accuracy: 5, heading: null, speed: null, t: 0, ...partial };
}

describe('bearingForFollow', () => {
  it('uses GPS heading when moving faster than 1 m/s', () => {
    const f = fix({ speed: 5, heading: 90 });
    expect(bearingForFollow(f, null)).toBe(90);
  });

  it('computes bearing from prev to cur when stationary speed but moved > 5 m', () => {
    // prev is ~100 m due west of cur at the same latitude -> bearing should be ~east (90deg)
    const prev = fix({ lon: 106.82 - 100 / 111320, lat: -6.2, speed: 0, heading: null });
    const cur = fix({ lon: 106.82, lat: -6.2, speed: 0, heading: null });
    const bearing = bearingForFollow(cur, prev);
    expect(bearing).not.toBeNull();
    expect(bearing).toBeGreaterThan(85);
    expect(bearing).toBeLessThan(95);
  });

  it('falls back to prev-distance bearing when moving fast but heading is null', () => {
    // GPS sometimes reports a real speed with a null heading (e.g. cold fix); should not give up.
    const prev = fix({ lon: 106.82 - 100 / 111320, lat: -6.2, speed: 5, heading: null });
    const cur = fix({ lon: 106.82, lat: -6.2, speed: 5, heading: null });
    const bearing = bearingForFollow(cur, prev);
    expect(bearing).not.toBeNull();
    expect(bearing).toBeGreaterThan(85);
    expect(bearing).toBeLessThan(95);
  });

  it('returns null with no previous fix and low speed', () => {
    const f = fix({ speed: 0, heading: null });
    expect(bearingForFollow(f, null)).toBeNull();
  });

  it('returns null when the fix barely moved (< 5 m)', () => {
    const prev = fix({ lon: 106.82, lat: -6.2, speed: 0, heading: null });
    const cur = fix({ lon: 106.82 + 2 / 111320, lat: -6.2, speed: 0, heading: null });
    expect(bearingForFollow(cur, prev)).toBeNull();
  });
});

describe('circlePolygon', () => {
  it('returns a closed ring of 33 points', () => {
    const ring = circlePolygon(106.82, -6.2, 20);
    expect(ring).toHaveLength(33);
    expect(ring[0]).toEqual(ring[32]);
  });
});

describe('distanceM', () => {
  it('is about 111 km per degree of latitude', () => {
    const d = distanceM(106.82, -6.2, 106.82, -6.2 - 1);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});
