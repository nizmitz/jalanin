import { describe, expect, it } from 'vitest';
import { STRINGS, t } from '../src/i18n';
import type { StringKey } from '../src/i18n';

// Derived from the Indonesian dictionary rather than a hand-written list, so a key added to
// STRINGS.id is automatically exercised here without anyone remembering to update this file.
const KEYS = Object.keys(STRINGS.id) as StringKey[];

describe('t', () => {
  for (const key of KEYS) {
    it(`defines "${key}" in Indonesian`, () => {
      expect(t(key, 'id')).toBeTruthy();
    });
    it(`defines "${key}" in English`, () => {
      expect(t(key, 'en')).toBeTruthy();
    });
  }

  it('en defines exactly the same key set as id', () => {
    expect(Object.keys(STRINGS.en).sort()).toEqual(Object.keys(STRINGS.id).sort());
  });

  it('alertEnter carries a {road} placeholder in both languages', () => {
    expect(t('alertEnter', 'id')).toContain('{road}');
    expect(t('alertEnter', 'en')).toContain('{road}');
  });
});
