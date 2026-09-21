import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLang,
  getParity,
  getTheme,
  resetStoreForTests,
  setLang,
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

describe('theme', () => {
  it('delegates to theme.ts systemTheme()', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    expect(['light', 'dark']).toContain(getTheme());
    vi.unstubAllGlobals();
  });
});

describe('subscribe', () => {
  it('fires on setParity, setLang, and setTheme', () => {
    const fn = vi.fn();
    const unsubscribe = subscribe(fn);
    setParity('even');
    setLang('en');
    expect(fn).toHaveBeenCalledTimes(2);
    unsubscribe();
    setParity('odd');
    expect(fn).toHaveBeenCalledTimes(2);
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
