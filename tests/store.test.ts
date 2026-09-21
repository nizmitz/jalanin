import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LAYERS,
  getLang,
  getLayers,
  getOnboarded,
  getParity,
  getTheme,
  resetStoreForTests,
  setLang,
  setLayer,
  setOnboarded,
  setParity,
  subscribe,
} from '../src/store';

beforeEach(() => {
  localStorage.clear();
  resetStoreForTests();
});

afterEach(() => {
  localStorage.clear();
});

describe('parity', () => {
  it('defaults to odd', () => {
    expect(getParity()).toBe('odd');
  });

  it('round-trips through localStorage', () => {
    setParity('even');
    expect(getParity()).toBe('even');
  });
});

describe('lang', () => {
  it('falls back to en when navigator.language is not Indonesian', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    expect(getLang()).toBe('en');
  });

  it('defaults to id when navigator.language starts with id', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('id-ID');
    expect(getLang()).toBe('id');
  });

  it('round-trips through localStorage', () => {
    setLang('en');
    expect(getLang()).toBe('en');
  });
});

describe('legacy key migration', () => {
  it('reads gage.parity when jalanin.parity is absent and copies it forward', () => {
    localStorage.setItem('gage.parity', 'even');
    expect(getParity()).toBe('even');
    expect(localStorage.getItem('jalanin.parity')).toBe('even');
    expect(localStorage.getItem('gage.parity')).toBe('even'); // legacy left intact
  });

  it('prefers jalanin.* over gage.* when both exist', () => {
    localStorage.setItem('gage.parity', 'even');
    localStorage.setItem('jalanin.parity', 'odd');
    expect(getParity()).toBe('odd');
  });

  it('reads gage.lang when jalanin.lang is absent', () => {
    localStorage.setItem('gage.lang', 'en');
    expect(getLang()).toBe('en');
  });

  it('reads gage.layers when jalanin.layers is absent', () => {
    localStorage.setItem('gage.layers', JSON.stringify(['toll']));
    expect(getLayers()).toEqual(new Set(['toll']));
  });

  it('writes only the new key, never the legacy one', () => {
    setParity('even');
    expect(localStorage.getItem('gage.parity')).toBeNull();
    expect(localStorage.getItem('jalanin.parity')).toBe('even');
  });
});

describe('layers', () => {
  it('defaults to gage, mrt, lrt, krl', () => {
    expect(getLayers()).toEqual(new Set(DEFAULT_LAYERS));
  });

  it('round-trips a toggle through localStorage as a JSON array', () => {
    setLayer('toll', true);
    expect(getLayers().has('toll')).toBe(true);
    const stored: unknown = JSON.parse(localStorage.getItem('jalanin.layers') ?? '[]');
    expect(stored).toContain('toll');
  });

  it('removes a layer when toggled off', () => {
    setLayer('mrt', false);
    expect(getLayers().has('mrt')).toBe(false);
  });

  it('persists across resetStoreForTests via localStorage', () => {
    setLayer('flood', true);
    resetStoreForTests();
    expect(getLayers().has('flood')).toBe(true);
  });

  it('falls back to defaults when the stored JSON is malformed', () => {
    localStorage.setItem('jalanin.layers', 'not json');
    expect(getLayers()).toEqual(new Set(DEFAULT_LAYERS));
  });

  it('falls back to defaults when the stored JSON is not a string array', () => {
    localStorage.setItem('jalanin.layers', JSON.stringify({ a: 1 }));
    expect(getLayers()).toEqual(new Set(DEFAULT_LAYERS));
  });
});

describe('onboarded', () => {
  it('defaults to false', () => {
    expect(getOnboarded()).toBe(false);
  });

  it('round-trips through localStorage', () => {
    setOnboarded();
    expect(getOnboarded()).toBe(true);
  });
});

describe('theme', () => {
  it('delegates to theme.ts systemTheme()', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    expect(['light', 'dark']).toContain(getTheme());
    vi.unstubAllGlobals();
  });
});

describe('subscribe', () => {
  it('fires on setParity, setLang, setLayer, and setOnboarded', () => {
    const fn = vi.fn();
    const unsubscribe = subscribe(fn);
    setParity('even');
    setLang('en');
    setLayer('toll', true);
    setOnboarded();
    expect(fn).toHaveBeenCalledTimes(4);
    unsubscribe();
    setParity('odd');
    expect(fn).toHaveBeenCalledTimes(4);
  });
});

describe('storage failures', () => {
  it('does not throw when localStorage.getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => getParity()).not.toThrow();
    spy.mockRestore();
  });

  it('does not throw when localStorage.setItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => {
      setParity('even');
    }).not.toThrow();
    spy.mockRestore();
  });
});

describe('storage failure', () => {
  it('keeps the session value when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    setParity('even');
    setLang('en');
    expect(getParity()).toBe('even');
    expect(getLang()).toBe('en');
    vi.restoreAllMocks();
  });
});
