import { describe, expect, it } from 'vitest';
import { ENTER_M, LEAVE_M, createProximity, nearestGageRoad } from '../src/proximity';
import type { Fix } from '../src/geo';
import type { FeatureCollection, MultiLineString } from 'geojson';
import type { GageProps } from '../src/types';

// A single straight N-S line along lon 106.82, well south of the real gage roads.
const LINE_LON = 106.82;
const LINE_LAT = -6.25;
const METERS_PER_DEGREE_LON = 111_320 * Math.cos((LINE_LAT * Math.PI) / 180);

function roads(): FeatureCollection<MultiLineString, GageProps> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: 'test-road', name: 'Test Road', group: 'spine' },
        geometry: {
          type: 'MultiLineString',
          coordinates: [
            [
              [LINE_LON, -6.3],
              [LINE_LON, -6.2],
            ],
          ],
        },
      },
    ],
  };
}

// A fix `eastMeters` due east of the line, at LINE_LAT.
function fixNear(eastMeters: number, accuracy = 5): Fix {
  return {
    lon: LINE_LON + eastMeters / METERS_PER_DEGREE_LON,
    lat: LINE_LAT,
    accuracy,
    heading: null,
    speed: null,
    t: 0,
  };
}

describe('nearestGageRoad', () => {
  it('finds the road when the fix is 10 m away', () => {
    const nearest = nearestGageRoad(fixNear(10), roads());
    expect(nearest).not.toBeNull();
    expect(nearest?.id).toBe('test-road');
    expect(nearest?.distanceM).toBeLessThan(30);
  });

  it('returns null when the fix is well outside the bbox prefilter', () => {
    expect(nearestGageRoad(fixNear(2000), roads())).toBeNull();
  });
});

describe('createProximity', () => {
  it('fires entered once per entry when blocked, with hysteresis between enter/leave', () => {
    const proximity = createProximity();
    const distances = [25, 25, 70, 25];
    const enteredAt: number[] = [];
    distances.forEach((d, i) => {
      const { entered } = proximity.update(fixNear(d), true, roads());
      if (entered) enteredAt.push(i);
    });
    expect(enteredAt).toEqual([0, 3]);
  });

  it('never fires entered when not blocked', () => {
    const proximity = createProximity();
    const distances = [25, 25, 70, 25];
    for (const d of distances) {
      const { entered } = proximity.update(fixNear(d), false, roads());
      expect(entered).toBeNull();
    }
  });

  it('ignores low-accuracy fixes', () => {
    const proximity = createProximity();
    const { entered, inside } = proximity.update(fixNear(10, 80), true, roads());
    expect(entered).toBeNull();
    expect(inside).toBeNull();
  });

  it('holds inside state through a low-accuracy fix (does not clear on a noisy reading)', () => {
    const proximity = createProximity();
    proximity.update(fixNear(ENTER_M - 5), true, roads());
    const { entered, inside } = proximity.update(fixNear(ENTER_M - 5, 80), true, roads());
    expect(entered).toBeNull();
    expect(inside).not.toBeNull();
  });

  it('clears inside once the fix leaves past LEAVE_M', () => {
    const proximity = createProximity();
    proximity.update(fixNear(ENTER_M - 5), true, roads());
    const { inside } = proximity.update(fixNear(LEAVE_M + 5), true, roads());
    expect(inside).toBeNull();
  });
});
