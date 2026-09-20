import { describe, expect, it } from 'vitest';
import { t } from '../src/i18n';
import type { StringKey } from '../src/i18n';

const KEYS: StringKey[] = [
  'title',
  'odd',
  'even',
  'active',
  'inactive',
  'holiday',
  'weekend',
  'hours',
  'follow',
  'stopFollow',
  'alertEnter',
  'offlineReady',
  'downloadMap',
  'downloading',
  'mapReady',
  'dataAsOf',
  'statusOk',
  'statusAvoid',
];

describe('t', () => {
  for (const key of KEYS) {
    it(`defines "${key}" in Indonesian`, () => {
      expect(t(key, 'id')).toBeTruthy();
    });
    it(`defines "${key}" in English`, () => {
      expect(t(key, 'en')).toBeTruthy();
    });
  }

  it('alertEnter carries a {road} placeholder in both languages', () => {
    expect(t('alertEnter', 'id')).toContain('{road}');
    expect(t('alertEnter', 'en')).toContain('{road}');
  });
});
