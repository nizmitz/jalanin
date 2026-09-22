import { describe, expect, it } from 'vitest';
import { daysSince, freshness } from '../src/freshness';

const NOW = new Date('2026-09-22T00:00:00Z');

function isoDaysAgo(days: number): string {
  const d = new Date(NOW.getTime() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe('daysSince', () => {
  it('counts whole days between asOf and now', () => {
    expect(daysSince(isoDaysAgo(30), NOW)).toBe(30);
  });

  it('returns Infinity for an invalid date', () => {
    expect(daysSince('not-a-date', NOW)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('freshness', () => {
  it('is fresh at 179 days old', () => {
    expect(freshness(isoDaysAgo(179), NOW)).toBe('fresh');
  });

  it('is fresh at exactly 180 days old (not yet older than 180)', () => {
    expect(freshness(isoDaysAgo(180), NOW)).toBe('fresh');
  });

  it('is stale at 181 days old', () => {
    expect(freshness(isoDaysAgo(181), NOW)).toBe('stale');
  });

  it('treats an invalid date as stale', () => {
    expect(freshness('not-a-date', NOW)).toBe('stale');
  });

  it('defaults `now` to the current time when omitted', () => {
    const recent = new Date().toISOString().slice(0, 10);
    expect(freshness(recent)).toBe('fresh');
  });
});
