export type Theme = 'light' | 'dark';

export const THEME_KEY = 'jalanin.theme';
const LEGACY_THEME_KEY = 'gage.theme';

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark';
}

// Storage can throw (private mode, blocked site data); never let it block startup. Falls back to
// the pre-rename key so users who set a theme before the app was renamed keep their choice.
function readStored(): string | null {
  try {
    const current = localStorage.getItem(THEME_KEY);
    if (current !== null) return current;
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy !== null) localStorage.setItem(THEME_KEY, legacy); // copy forward once
    return legacy;
  } catch {
    return null;
  }
}

export function systemTheme(): Theme {
  const stored = readStored();
  if (isTheme(stored)) return stored;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore: theme still applies for this session
  }
}
