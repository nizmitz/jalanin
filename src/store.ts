import { setTheme as persistTheme, systemTheme } from './theme';
import type { Theme } from './theme';
import type { Lang } from './i18n';
import type { Parity } from './gage';

const PARITY_KEY = 'gage.parity';
const LANG_KEY = 'gage.lang';

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore: setting still applies for this session
  }
}

function isParity(value: string | null): value is Parity {
  return value === 'odd' || value === 'even';
}

function isLang(value: string | null): value is Lang {
  return value === 'id' || value === 'en';
}

function defaultLang(): Lang {
  return navigator.language.toLowerCase().startsWith('id') ? 'id' : 'en';
}

const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// In-memory values are authoritative for the session; storage is best-effort persistence.
let parity: Parity | null = null;
let lang: Lang | null = null;

export function getParity(): Parity {
  if (parity === null) {
    const stored = readStored(PARITY_KEY);
    parity = isParity(stored) ? stored : 'odd';
  }
  return parity;
}

export function setParity(p: Parity): void {
  parity = p;
  writeStored(PARITY_KEY, p);
  notify();
}

export function getLang(): Lang {
  if (lang === null) {
    const stored = readStored(LANG_KEY);
    lang = isLang(stored) ? stored : defaultLang();
  }
  return lang;
}

export function setLang(next: Lang): void {
  lang = next;
  writeStored(LANG_KEY, next);
  notify();
}

// Test hook: forget cached values so each test starts from storage.
export function resetStoreForTests(): void {
  parity = null;
  lang = null;
}

export function getTheme(): Theme {
  return systemTheme();
}

export function setTheme(theme: Theme): void {
  persistTheme(theme);
  notify();
}
