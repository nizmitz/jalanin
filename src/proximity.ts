import { lineString, point } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import type { FeatureCollection, MultiLineString, Position } from 'geojson';
import type { Fix } from './geo';
import type { GageProps } from './types';

export const ENTER_M = 30;
export const LEAVE_M = 60;
export const MAX_ACCURACY_M = 50;

// Prefilter pad in degrees before running the (relatively expensive) nearest-point-on-line
// calculation; anything whose padded bbox can't contain the fix is skipped outright.
const BBOX_PAD_DEG = 0.01;

export interface Nearest {
  id: string;
  name: string;
  distanceM: number;
}

function withinPaddedBbox(fix: Fix, line: Position[]): boolean {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon = NaN, lat = NaN] of line) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return (
    fix.lon >= minLon - BBOX_PAD_DEG &&
    fix.lon <= maxLon + BBOX_PAD_DEG &&
    fix.lat >= minLat - BBOX_PAD_DEG &&
    fix.lat <= maxLat + BBOX_PAD_DEG
  );
}

// Nearest gage road to `fix`, or null if every road's padded bbox is too far away to bother
// checking precisely. Roads are MultiLineStrings; each line part is checked separately.
export function nearestGageRoad(
  fix: Fix,
  roads: FeatureCollection<MultiLineString, GageProps>,
): Nearest | null {
  const fixPoint = point([fix.lon, fix.lat]);
  let best: Nearest | null = null;

  for (const feature of roads.features) {
    for (const line of feature.geometry.coordinates) {
      if (line.length < 2 || !withinPaddedBbox(fix, line)) continue;
      const snapped = nearestPointOnLine(lineString(line), fixPoint, { units: 'kilometers' });
      const distanceM = snapped.properties.pointDistance * 1000;
      if (!best || distanceM < best.distanceM) {
        best = { id: feature.properties.id, name: feature.properties.name, distanceM };
      }
    }
  }

  return best;
}

export interface ProximityResult {
  entered: Nearest | null;
  inside: Nearest | null;
}

export interface Proximity {
  update(
    fix: Fix,
    blocked: boolean,
    roads: FeatureCollection<MultiLineString, GageProps>,
  ): ProximityResult;
  // Clears the "inside" hysteresis state without waiting for a LEAVE_M fix. Needed whenever the
  // gage layer itself is turned off: re-enabling it later must not immediately report `inside`
  // for a road the user never actually re-entered.
  reset(): void;
}

// Hysteresis + accuracy gate around nearestGageRoad: fires `entered` once when crossing inward
// past ENTER_M, clears `inside` once the fix drifts back out past LEAVE_M (or the road is no
// longer blocked for this plate). Low-accuracy fixes are ignored entirely so a noisy GPS fix
// near a parallel road doesn't produce a false alert (Review Focus #4).
export function createProximity(): Proximity {
  let inside: Nearest | null = null;

  return {
    update(fix, blocked, roads) {
      if (fix.accuracy > MAX_ACCURACY_M) {
        return { entered: null, inside };
      }

      const nearest = blocked ? nearestGageRoad(fix, roads) : null;

      if (!nearest) {
        inside = null;
        return { entered: null, inside };
      }

      if (!inside) {
        if (nearest.distanceM <= ENTER_M) {
          inside = nearest;
          return { entered: nearest, inside };
        }
        return { entered: null, inside: null };
      }

      if (nearest.distanceM > LEAVE_M) {
        inside = null;
        return { entered: null, inside: null };
      }

      inside = nearest;
      return { entered: null, inside };
    },
    reset() {
      inside = null;
    },
  };
}
