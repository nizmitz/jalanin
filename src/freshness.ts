// Curated/layer data carries a `data_as_of` ISO date; anything older than this many days gets an
// amber "perlu dicek" badge in the layer panel and About sheet (Global Constraints, Task A10-lite).
const STALE_AFTER_DAYS = 180;
const MS_PER_DAY = 86_400_000;

export function daysSince(asOf: string, now: Date = new Date()): number {
  const then = new Date(asOf);
  if (Number.isNaN(then.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - then.getTime()) / MS_PER_DAY);
}

export function freshness(asOf: string, now: Date = new Date()): 'fresh' | 'stale' {
  return daysSince(asOf, now) > STALE_AFTER_DAYS ? 'stale' : 'fresh';
}
