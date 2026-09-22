import { afterEach, describe, expect, it, vi } from 'vitest';
import { setTheme, systemTheme, THEME_KEY } from '../src/theme';

function mockMatchMedia(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('systemTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('returns dark when the OS prefers dark', () => {
    mockMatchMedia(true);
    expect(systemTheme()).toBe('dark');
  });

  it('returns light when the OS does not prefer dark', () => {
    mockMatchMedia(false);
    expect(systemTheme()).toBe('light');
  });

  it('stored override wins over the OS', () => {
    mockMatchMedia(true);
    setTheme('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(systemTheme()).toBe('light');
  });

  it('reads the legacy gage.theme key when jalanin.theme is absent', () => {
    mockMatchMedia(false);
    localStorage.setItem('gage.theme', 'dark');
    expect(systemTheme()).toBe('dark');
  });

  it('prefers the new key over the legacy one', () => {
    mockMatchMedia(false);
    localStorage.setItem('gage.theme', 'dark');
    localStorage.setItem(THEME_KEY, 'light');
    expect(systemTheme()).toBe('light');
  });

  it('writes only the new key, never the legacy one', () => {
    mockMatchMedia(false);
    setTheme('dark');
    expect(localStorage.getItem('gage.theme')).toBeNull();
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('falls back to the OS when storage throws', () => {
    mockMatchMedia(true);
    const boom = () => {
      throw new Error('denied');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
    expect(() => {
      setTheme('dark');
    }).not.toThrow();
    expect(systemTheme()).toBe('dark');
    vi.restoreAllMocks();
  });
});
