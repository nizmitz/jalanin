import { setTheme as persistTheme, systemTheme } from './theme';
import type { Theme } from './theme';
import type { Lang } from './i18n';
import type { Parity } from './gage';

const NEW_PREFIX = 'jalanin.';
const LEGACY_PREFIX = 'gage.';

export const DEFAULT_LAYERS = ['gage', 'mrt', 'lrt', 'krl'] as const;

// Falls back to the pre-rename `gage.<key>` value so users who set preferences before the app
// was renamed keep them. A legacy hit is copied forward once so later reads use the new key;
// the legacy key is left untouched.
function readStored(key: string): string | null {
  try {
    const current = localStorage.getItem(NEW_PREFIX + key);
    if (current !== null) return current;
    const legacy = localStorage.getItem(LEGACY_PREFIX + key);
    if (legacy !== null) localStorage.setItem(NEW_PREFIX + key, legacy);
    return legacy;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(NEW_PREFIX + key, value);
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
let layers: Set<string> | null = null;
let onboarded: boolean | null = null;

export function getParity(): Parity {
  if (parity === null) {
    const stored = readStored('parity');
    parity = isParity(stored) ? stored : 'odd';
  }
  return parity;
}

export function setParity(p: Parity): void {
  parity = p;
  writeStored('parity', p);
  notify();
}

export function getLang(): Lang {
  if (lang === null) {
    const stored = readStored('lang');
    lang = isLang(stored) ? stored : defaultLang();
  }
  return lang;
}

export function setLang(next: Lang): void {
  lang = next;
  writeStored('lang', next);
  notify();
}

function parseLayers(raw: string | null): Set<string> {
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
        return new Set(parsed);
      }
    } catch {
      // fall through to defaults
    }
  }
  return new Set(DEFAULT_LAYERS);
}

export function getLayers(): Set<string> {
  if (layers === null) {
    layers = parseLayers(readStored('layers'));
  }
  return layers;
}

export function setLayer(id: string, on: boolean): void {
  const current = getLayers();
  if (on) {
    current.add(id);
  } else {
    current.delete(id);
  }
  layers = current;
  writeStored('layers', JSON.stringify([...current]));
  notify();
}

export function getOnboarded(): boolean {
  if (onboarded === null) {
    onboarded = readStored('onboarded') === 'true';
  }
  return onboarded;
}

export function setOnboarded(): void {
  onboarded = true;
  writeStored('onboarded', 'true');
  notify();
}

// Test hook: forget cached values so each test starts from storage.
export function resetStoreForTests(): void {
  parity = null;
  lang = null;
  layers = null;
  onboarded = null;
}

export function getTheme(): Theme {
  return systemTheme();
}

export function setTheme(theme: Theme): void {
  persistTheme(theme);
  notify();
}
