// Feeds the About sheet's data-sources table (src/about.ts): one row per curated/layer data file
// plus the basemap, each with its `data_as_of` and source URL(s) so a stale entry can be flagged
// (src/freshness.ts) and linked back to where it came from.
import { HOLIDAYS_AS_OF, HOLIDAYS_SOURCE } from './holidays';
import { LAYERS } from './layers/registry';
import { GAGE_ROADS } from './roads';
import type { StringKey } from './i18n';
import type { FeatureCollection } from 'geojson';

export interface DataSourceEntry {
  id: string;
  labelKey: StringKey;
  asOf: string;
  sources: string[];
}

// Non-standard but present on every layer/curated FeatureCollection this app builds (see
// scripts/lib.ts and src/layers/panel.ts's own `FeatureCollectionWithMeta`): a top-level
// `properties.data_as_of` + `properties.source` list.
type FeatureCollectionWithMeta = FeatureCollection & {
  properties?: { data_as_of?: string; source?: string[] };
};

function fromFeatureCollection(fc: FeatureCollection): { asOf: string; sources: string[] } {
  const props = (fc as FeatureCollectionWithMeta).properties;
  return { asOf: props?.data_as_of ?? 'unknown', sources: props?.source ?? [] };
}

export function listDataSources(): DataSourceEntry[] {
  const gage = fromFeatureCollection(GAGE_ROADS);
  const entries: DataSourceEntry[] = [
    { id: 'gage', labelKey: 'layerGage', asOf: gage.asOf, sources: gage.sources },
  ];

  for (const def of LAYERS) {
    if (def.id === 'gage') continue; // pseudo-entry, already covered above
    if (typeof def.data === 'function') continue; // lazy layers have no synchronously-known asOf
    const { asOf, sources } = fromFeatureCollection(def.data);
    entries.push({ id: def.id, labelKey: def.labelKey, asOf, sources });
  }

  entries.push({
    id: 'holidays',
    labelKey: 'dataSourceHolidays',
    asOf: HOLIDAYS_AS_OF,
    sources: [HOLIDAYS_SOURCE],
  });

  entries.push({
    id: 'basemap',
    labelKey: 'dataSourceBasemap',
    asOf: import.meta.env.VITE_BASEMAP_DATE ?? 'unknown',
    sources: ['https://github.com/protomaps/basemaps'],
  });

  return entries;
}
