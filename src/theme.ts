export type Theme = 'light' | 'dark';

export const THEME_KEY = 'gage.theme';

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark';
}

// Storage can throw (private mode, blocked site data); never let it block startup.
function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
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
