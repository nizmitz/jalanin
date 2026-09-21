import { describe, expect, it } from 'vitest';
import { HOLIDAYS, HOLIDAYS_YEAR } from '../src/holidays';

describe('holidays', () => {
  it('has Independence Day', () => {
    expect(HOLIDAYS.has('2026-08-17')).toBe(true);
  });
  it('all entries are ISO dates of the declared year', () => {
    for (const d of HOLIDAYS)
      expect(d).toMatch(new RegExp(`^${String(HOLIDAYS_YEAR)}-\\d{2}-\\d{2}$`));
  });
  it('non-empty', () => {
    expect(HOLIDAYS.size).toBeGreaterThan(10);
  });
});
