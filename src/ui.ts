import { t } from './i18n';
import type { Lang } from './i18n';
import type { DayKind, Parity, Verdict } from './gage';
import type { Theme } from './theme';

export interface UiDeps {
  initial: { parity: Parity; theme: Theme; lang: Lang };
  onParity: (p: Parity) => void;
  onFollow: () => void;
  onTheme: () => void;
  onLang: () => void;
}

export interface Ui {
  setStatus: (v: Verdict, active: boolean, day: DayKind) => void;
  setFollow: (on: boolean) => void;
  showAlert: (text: string | null) => void;
  setLang: (lang: Lang) => void;
  setParity: (p: Parity) => void;
  // Swaps the theme button's icon to match the active theme (sun in dark mode, moon in light).
  setTheme: (theme: Theme) => void;
  // Reserved container for the Task 11 offline-download banner; hidden until that task fills it.
  offlineBanner: HTMLElement;
}

const CROSSHAIR_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>`;

const SUN_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>`;

const MOON_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>`;

// Chip color: green when the plate is clear right now, red when it collides with an active
// gage window. Anything else (off-hours, weekend, holiday) stays neutral.
function chipClass(v: Verdict, active: boolean): 'ok' | 'no' | 'neutral' {
  if (active && v === 'ok') return 'ok';
  if (active && v === 'avoid') return 'no';
  return 'neutral';
}

function chipText(v: Verdict, active: boolean, day: DayKind, lang: Lang): string {
  if (active) return v === 'avoid' ? t('activeAvoid', lang) : t('activeOk', lang);
  if (day === 'holiday') return t('holiday', lang);
  if (day === 'weekend') return t('weekend', lang);
  return t('inactive', lang);
}

function chipTitle(v: Verdict, lang: Lang): string {
  if (v === 'ok') return t('statusOk', lang);
  if (v === 'avoid') return t('statusAvoid', lang);
  return t('inactive', lang);
}

export function mountUi(root: HTMLElement, deps: UiDeps): Ui {
  let lang: Lang = deps.initial.lang;
  let lastVerdict: Verdict = 'off';
  let lastActive = false;
  let lastDay: DayKind = 'weekday';
  let followOn = false;

  root.innerHTML = `
    <div class="topbar">
      <div class="segmented" role="group" aria-label="parity">
        <button type="button" class="segment" data-parity="odd" aria-pressed="${deps.initial.parity === 'odd' ? 'true' : 'false'}"></button>
        <button type="button" class="segment" data-parity="even" aria-pressed="${deps.initial.parity === 'even' ? 'true' : 'false'}"></button>
      </div>
      <div class="status" data-status aria-live="polite" aria-atomic="true"></div>
    </div>
    <div class="fab-stack">
      <button type="button" class="fab" data-action="follow" aria-pressed="false">${CROSSHAIR_SVG}</button>
      <button type="button" class="fab" data-action="theme">${deps.initial.theme === 'dark' ? SUN_SVG : MOON_SVG}</button>
      <button type="button" class="fab fab--text" data-action="lang">ID</button>
    </div>
    <div class="offline-banner" data-offline-banner hidden></div>
    <div class="alert" data-alert hidden></div>
    <div class="footer" data-footer></div>
  `;

  const oddBtn = root.querySelector<HTMLButtonElement>('[data-parity="odd"]');
  const evenBtn = root.querySelector<HTMLButtonElement>('[data-parity="even"]');
  const statusEl = root.querySelector<HTMLDivElement>('[data-status]');
  const followBtn = root.querySelector<HTMLButtonElement>('[data-action="follow"]');
  const themeBtn = root.querySelector<HTMLButtonElement>('[data-action="theme"]');
  const langBtn = root.querySelector<HTMLButtonElement>('[data-action="lang"]');
  const alertEl = root.querySelector<HTMLDivElement>('[data-alert]');
  const footerEl = root.querySelector<HTMLDivElement>('[data-footer]');
  const offlineBannerEl = root.querySelector<HTMLDivElement>('[data-offline-banner]');
  if (!offlineBannerEl) throw new Error('missing offline banner slot');

  oddBtn?.addEventListener('click', () => {
    deps.onParity('odd');
  });
  evenBtn?.addEventListener('click', () => {
    deps.onParity('even');
  });
  followBtn?.addEventListener('click', deps.onFollow);
  themeBtn?.addEventListener('click', deps.onTheme);
  langBtn?.addEventListener('click', deps.onLang);

  function renderStatus(): void {
    if (!statusEl) return;
    const cls = chipClass(lastVerdict, lastActive);
    statusEl.className = `status status--${cls}`;
    statusEl.textContent = chipText(lastVerdict, lastActive, lastDay, lang);
    statusEl.title = chipTitle(lastVerdict, lang);
  }

  function renderLabels(): void {
    if (oddBtn) oddBtn.textContent = t('odd', lang);
    if (evenBtn) evenBtn.textContent = t('even', lang);
    if (followBtn)
      followBtn.setAttribute('aria-label', followOn ? t('stopFollow', lang) : t('follow', lang));
    if (themeBtn) themeBtn.setAttribute('aria-label', t('themeToggle', lang));
    if (langBtn) {
      langBtn.textContent = lang === 'id' ? 'ID' : 'EN';
      langBtn.setAttribute(
        'aria-label',
        lang === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia',
      );
    }
    document.documentElement.lang = lang;
    if (footerEl) footerEl.textContent = t('dataAsOf', lang);
    renderStatus();
  }

  renderLabels();

  return {
    setStatus(v, active, day) {
      lastVerdict = v;
      lastActive = active;
      lastDay = day;
      renderStatus();
    },
    setFollow(on) {
      followOn = on;
      followBtn?.setAttribute('aria-pressed', on ? 'true' : 'false');
      followBtn?.setAttribute('aria-label', on ? t('stopFollow', lang) : t('follow', lang));
    },
    showAlert(text) {
      if (!alertEl) return;
      if (text === null) {
        alertEl.setAttribute('hidden', '');
        alertEl.textContent = '';
        return;
      }
      alertEl.textContent = text;
      alertEl.removeAttribute('hidden');
    },
    setLang(next) {
      lang = next;
      renderLabels();
    },
    setParity(p) {
      oddBtn?.setAttribute('aria-pressed', p === 'odd' ? 'true' : 'false');
      evenBtn?.setAttribute('aria-pressed', p === 'even' ? 'true' : 'false');
    },
    setTheme(theme) {
      if (themeBtn) themeBtn.innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
    },
    offlineBanner: offlineBannerEl,
  };
}
