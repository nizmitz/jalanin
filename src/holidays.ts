import raw from './data/holidays-2026.json';

export const HOLIDAYS_YEAR = raw.year;
export const HOLIDAYS: ReadonlySet<string> = new Set(raw.dates);
