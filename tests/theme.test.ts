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
