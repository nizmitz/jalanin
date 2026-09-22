import { describe, expect, it } from 'vitest';
import { listDataSources } from '../src/data-sources';

describe('listDataSources', () => {
  const entries = listDataSources();

  it('every entry has an ISO as_of date or "unknown"', () => {
    for (const e of entries) {
      expect(e.asOf === 'unknown' || /^\d{4}-\d{2}-\d{2}$/.test(e.asOf)).toBe(true);
    }
  });

  it('ids are unique', () => {
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes gage, mrt, and holidays', () => {
    const ids = entries.map((e) => e.id);
    expect(ids).toContain('gage');
    expect(ids).toContain('mrt');
    expect(ids).toContain('holidays');
  });

  it('includes a basemap entry defaulting to "unknown" without the build-time env var', () => {
    const basemap = entries.find((e) => e.id === 'basemap');
    expect(basemap).toBeDefined();
    expect(basemap?.asOf).toBe('unknown');
  });

  it('every entry lists at least one source URL', () => {
    for (const e of entries) expect(e.sources.length).toBeGreaterThan(0);
  });
});
