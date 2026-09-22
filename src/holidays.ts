import raw from './data/holidays-2026.json';

export const HOLIDAYS_YEAR = raw.year;
export const HOLIDAYS: ReadonlySet<string> = new Set(raw.dates);
// Exposed for the About sheet's data-sources table (src/data-sources.ts).
export const HOLIDAYS_SOURCE = raw.source;
// When the list was last checked against the SKB, not the year it covers.
export const HOLIDAYS_AS_OF: string = raw.as_of;
