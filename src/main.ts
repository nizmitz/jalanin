import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { dayKind, isGageActive, jakartaTime, verdict } from './gage';
import { HOLIDAYS } from './holidays';
import { addGageLayers, roadState, setGageState } from './gage-layer';
import { addUserLayers, bearingForFollow, startCompass, startWatch, updateUser } from './geo';
import { t } from './i18n';
import { addAttribution, applyTheme, createMap } from './map';
import { basemapCached, offlineSupported, prefetchBasemap, storageEstimate } from './offline';
import { createProximity } from './proximity';
import { GAGE_ROADS } from './roads';
import { getLang, getParity, getTheme, setLang, setParity, setTheme } from './store';
import { mountUi } from './ui';
import { acquireWakeLock } from './wake';
import type { Fix } from './geo';
import type { Theme } from './theme';
import type { DayKind, Parity } from './gage';
import type { ReleaseWakeLock } from './wake';

const STATUS_POLL_MS = 30_000;
const OFFLINE_TOAST_MS = 3000;
// Never offer the ~80 MB basemap download if it would leave less than this much free.
const MIN_FREE_STORAGE_BYTES = 200 * 1024 * 1024;

const app = document.getElementById('app');
if (!app) throw new Error('missing #app element');

const mapEl = document.createElement('div');
mapEl.className = 'map';
const uiEl = document.createElement('div');
app.append(mapEl, uiEl);

let theme: Theme = getTheme();
let parity: Parity = getParity();
let lang = getLang();

document.documentElement.dataset.theme = theme;

const map = createMap(mapEl, theme);
addAttribution(map);

function currentState(): {
  state: ReturnType<typeof roadState>;
  verdict: ReturnType<typeof verdict>;
  active: boolean;
  day: DayKind;
} {
  const now = new Date();
  const v = verdict(parity, now, HOLIDAYS);
  const active = isGageActive(now, HOLIDAYS);
  const day = dayKind(jakartaTime(now), HOLIDAYS);
  return { state: roadState(v, active), verdict: v, active, day };
}

let lastFix: Fix | null = null;
let lastBearing: number | null = null;

// 'style.load' fires for the initial style and after every applyTheme().
map.on('style.load', () => {
  addGageLayers(map, currentState().state, theme);
  addUserLayers(map);
  // Layers are re-created empty by the addSource above; repaint the last known fix so the
  // user's dot/heading/accuracy circle don't vanish across a theme change.
  if (lastFix) updateUser(map, lastFix, lastBearing);
});

let followOn = false;
let followSession = 0;
let stopWatch: (() => void) | null = null;
let stopCompass: (() => void) | null = null;
let releaseWakeLock: ReleaseWakeLock | null = null;
let prevFix: Fix | null = null;
let compassHeading: number | null = null;
const proximity = createProximity();

function onGpsError(e: GeolocationPositionError): void {
  // TIMEOUT and POSITION_UNAVAILABLE are transient (tunnel, cold fix, momentary signal loss) —
  // the watch keeps running and will report a good fix again on its own. Only a denied
  // permission is fatal: the watch will never produce a fix, so stop and tell the user.
  if (e.code === e.PERMISSION_DENIED) {
    ui.showAlert(t('gpsDenied', lang));
    stopFollow();
  }
}

function onFix(f: Fix): void {
  // GPS heading/movement wins; the iOS compass fallback only fills in while stationary.
  const bearing = bearingForFollow(f, prevFix) ?? compassHeading;
  prevFix = f;
  lastFix = f;
  lastBearing = bearing;
  updateUser(map, f, bearing);

  if (followOn) {
    map.easeTo({
      center: [f.lon, f.lat],
      bearing: bearing ?? map.getBearing(),
      pitch: 45,
      zoom: Math.max(map.getZoom(), 15),
      duration: 500,
    });
  }

  const blocked = currentState().state === 'blocked';
  const { entered, inside } = proximity.update(f, blocked, GAGE_ROADS);
  if (entered) {
    ui.showAlert(t('alertEnter', lang).replace('{road}', entered.name));
    // lib.dom types navigator.vibrate as always present; not every browser implements it
    // (notably desktop Safari/Firefox), so feature-detect for real.
    if (typeof navigator.vibrate === 'function') navigator.vibrate([200, 100, 200]);
  } else if (inside === null) {
    ui.showAlert(null);
  }
}

function stopFollow(): void {
  followOn = false;
  followSession++; // invalidates any acquireWakeLock() promise still in flight from this session
  ui.setFollow(false);
  stopWatch?.();
  stopWatch = null;
  stopCompass?.();
  stopCompass = null;
  compassHeading = null;
  prevFix = null;
  releaseWakeLock?.();
  releaseWakeLock = null;
}

// Called synchronously from the follow button's click handler so the iOS compass permission
// prompt (which requires a user gesture) fires when startCompass calls requestPermission().
function startFollow(): void {
  followOn = true;
  followSession++;
  const session = followSession;
  ui.setFollow(true);
  stopWatch = startWatch(onFix, onGpsError);
  stopCompass = startCompass((heading) => {
    compassHeading = heading;
  });
  void acquireWakeLock().then((release) => {
    // If follow was stopped (or restarted) before the lock finished acquiring, this session is
    // stale: release the lock immediately instead of leaking it into the new session's state.
    if (session !== followSession) {
      release();
      return;
    }
    releaseWakeLock = release;
  });
}

// Drag cancels follow mode, but only while it's active (a plain map drag shouldn't be affected).
map.on('dragstart', () => {
  if (followOn) stopFollow();
});

const ui = mountUi(uiEl, {
  initial: { parity, theme, lang },
  onParity(p) {
    parity = p;
    setParity(p);
    const { state, verdict: v, active, day } = currentState();
    setGageState(map, state);
    ui.setStatus(v, active, day);
    ui.setParity(p);
  },
  onFollow() {
    if (followOn) stopFollow();
    else startFollow();
  },
  onTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(theme);
    document.documentElement.dataset.theme = theme;
    applyTheme(map, theme);
    ui.setTheme(theme);
  },
  onLang() {
    lang = lang === 'id' ? 'en' : 'id';
    setLang(lang);
    ui.setLang(lang);
    const { verdict: v, active, day } = currentState();
    ui.setStatus(v, active, day);
  },
});

{
  const { verdict: v, active, day } = currentState();
  ui.setStatus(v, active, day);
}

setInterval(() => {
  const { state, verdict: v, active, day } = currentState();
  setGageState(map, state);
  ui.setStatus(v, active, day);
}, STATUS_POLL_MS);

registerSW({
  onOfflineReady() {
    // Only claim the map is offline-ready if the basemap has actually been prefetched — the
    // precached shell alone (index.html/js/css/icons) is a much weaker guarantee.
    void basemapCached().then((cached) => {
      ui.showToast(cached ? t('offlineReady', lang) : t('shellReady', lang));
    });
  },
});

function makeDownloadButton(onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'offline-banner__btn';
  btn.textContent = t('downloadMap', lang);
  btn.addEventListener('click', () => {
    // Double-click guard: disable immediately so a second click can't start a second
    // concurrent prefetch before the first re-render removes this button from the banner.
    btn.disabled = true;
    onClick();
  });
  return btn;
}

function renderDownloadPrompt(banner: HTMLElement): void {
  banner.replaceChildren(makeDownloadButton(() => void runDownload(banner)));
}

async function runDownload(banner: HTMLElement): Promise<void> {
  const progress = document.createElement('span');
  progress.textContent = t('downloading', lang);
  banner.replaceChildren(progress);
  try {
    await prefetchBasemap((pct) => {
      progress.textContent = `${t('downloading', lang)} ${String(pct)}%`;
    });
    progress.textContent = t('mapReady', lang);
    setTimeout(() => {
      banner.hidden = true;
      banner.replaceChildren();
    }, OFFLINE_TOAST_MS);
  } catch {
    // Keep the failure text visible alongside the retry button, rather than a fresh render
    // that wipes it: the user should see *why* there's a button again.
    progress.textContent = t('downloadFailed', lang);
    banner.append(makeDownloadButton(() => void runDownload(banner)));
  }
}

// First-launch offline banner: offered once (until the basemap is cached), and only when there
// is enough free storage headroom for it — see Review Focus item 5 / Task 11.
void (async function setupOfflineBanner(): Promise<void> {
  const banner = ui.offlineBanner;
  try {
    if (!offlineSupported()) return;
    if (await basemapCached()) return;

    const { usage, quota } = await storageEstimate();
    if (quota > 0 && quota - usage < MIN_FREE_STORAGE_BYTES) {
      banner.textContent = t('storageLow', lang);
      banner.hidden = false;
      return;
    }

    renderDownloadPrompt(banner);
    banner.hidden = false;
  } catch {
    banner.textContent = t('downloadFailed', lang);
    banner.hidden = false;
  }
})();
