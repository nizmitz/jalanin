import type { FeatureCollection, MultiLineString } from 'geojson';
import gageRaw from '../data/gage.geojson?raw';
import type { GageProps } from './types';

// Parsed once and shared by gage-layer (map rendering) and proximity (GPS alerts) so both
// read the same 25 roads without either module depending on the other.
export const GAGE_ROADS: FeatureCollection<MultiLineString, GageProps> = JSON.parse(
  gageRaw,
) as FeatureCollection<MultiLineString, GageProps>;
