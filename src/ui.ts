import { hideBackground, trapTabKey } from './dialog';
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
  // Transient status toast (e.g. "map ready offline"). Auto-clears on its own timer, independent
  // of showAlert — a proximity alert arriving mid-toast must not be wiped by the toast's timeout.
  showToast: (text: string, ms?: number) => void;
  setLang: (lang: Lang) => void;
  setParity: (p: Parity) => void;
  // Swaps the theme button's icon to match the active theme (sun in dark mode, moon in light).
  setTheme: (theme: Theme) => void;
  // Reserved container for the Task 11 offline-download banner; hidden until that task fills it.
  offlineBanner: HTMLElement;
  // Opener for the layer panel (src/layers/panel.ts); main.ts owns wiring its click since the
  // panel needs the layer registry and map, which ui.ts doesn't know about.
  layersButton: HTMLButtonElement;
  openMore: () => void;
  closeMore: () => void;
}

const CROSSHAIR_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>`;

const LAYERS_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M3 12l9 5 9-5"/><path d="M3 16l9 5 9-5"/></svg>`;

const MORE_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;

const SUN_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>`;

const MOON_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>`;

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
  let moreOpener: HTMLElement | null = null;

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
      <button type="button" class="fab" data-action="layers">${LAYERS_SVG}</button>
      <button type="button" class="fab" data-action="more">${MORE_SVG}</button>
    </div>
    <div class="sheet more-sheet" role="dialog" aria-modal="true" aria-labelledby="more-sheet-title" hidden>
      <div class="sheet__header">
        <h2 class="sheet__title" id="more-sheet-title"></h2>
        <button type="button" class="sheet__close" data-more-close></button>
      </div>
      <div class="more-sheet__list">
        <button type="button" class="more-sheet__item" data-action="theme"><span data-theme-icon>${deps.initial.theme === 'dark' ? SUN_SVG : MOON_SVG}</span><span data-theme-label></span></button>
        <button type="button" class="more-sheet__item" data-action="lang"><span data-lang-label></span></button>
        <button type="button" class="more-sheet__item" data-action="share" hidden disabled></button>
        <button type="button" class="more-sheet__item" data-action="about" hidden></button>
      </div>
    </div>
    <div class="offline-banner" data-offline-banner hidden></div>
    <div class="toast" data-toast hidden></div>
    <div class="alert" data-alert hidden></div>
    <div class="footer" data-footer></div>
  `;

  const oddBtn = root.querySelector<HTMLButtonElement>('[data-parity="odd"]');
  const evenBtn = root.querySelector<HTMLButtonElement>('[data-parity="even"]');
  const statusEl = root.querySelector<HTMLDivElement>('[data-status]');
  const followBtn = root.querySelector<HTMLButtonElement>('[data-action="follow"]');
  const layersBtn = root.querySelector<HTMLButtonElement>('[data-action="layers"]');
  const moreBtn = root.querySelector<HTMLButtonElement>('[data-action="more"]');
  const moreSheet = root.querySelector<HTMLDivElement>('.more-sheet');
  const moreCloseBtn = root.querySelector<HTMLButtonElement>('[data-more-close]');
  const moreTitleEl = root.querySelector<HTMLHeadingElement>('#more-sheet-title');
  const themeBtn = root.querySelector<HTMLButtonElement>('[data-action="theme"]');
  const themeIconEl = root.querySelector<HTMLSpanElement>('[data-theme-icon]');
  const themeLabelEl = root.querySelector<HTMLSpanElement>('[data-theme-label]');
  const langBtn = root.querySelector<HTMLButtonElement>('[data-action="lang"]');
  const langLabelEl = root.querySelector<HTMLSpanElement>('[data-lang-label]');
  const alertEl = root.querySelector<HTMLDivElement>('[data-alert]');
  const toastEl = root.querySelector<HTMLDivElement>('[data-toast]');
  const footerEl = root.querySelector<HTMLDivElement>('[data-footer]');
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  const offlineBannerEl = root.querySelector<HTMLDivElement>('[data-offline-banner]');
  if (!offlineBannerEl) throw new Error('missing offline banner slot');
  if (!layersBtn || !moreBtn || !moreSheet || !moreCloseBtn) {
    throw new Error('missing fab-stack or more-sheet element');
  }
  // Reassigned to non-nullable bindings so the closures below (which TS can't narrow across
  // function boundaries) don't need a non-null assertion on every access.
  const layersBtnEl: HTMLButtonElement = layersBtn;
  const moreBtnEl: HTMLButtonElement = moreBtn;
  const moreSheetEl: HTMLDivElement = moreSheet;
  const moreCloseBtnEl: HTMLButtonElement = moreCloseBtn;

  oddBtn?.addEventListener('click', () => {
    deps.onParity('odd');
  });
  evenBtn?.addEventListener('click', () => {
    deps.onParity('even');
  });
  followBtn?.addEventListener('click', deps.onFollow);
  themeBtn?.addEventListener('click', deps.onTheme);
  langBtn?.addEventListener('click', deps.onLang);

  let restoreMoreBackground: (() => void) | null = null;

  function onMoreKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMore();
      return;
    }
    trapTabKey(moreSheetEl, e);
  }

  function openMore(): void {
    moreOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    moreSheetEl.hidden = false;
    restoreMoreBackground = hideBackground(moreSheetEl);
    document.addEventListener('keydown', onMoreKeydown);
    moreCloseBtnEl.focus();
  }

  function closeMore(): void {
    moreSheetEl.hidden = true;
    document.removeEventListener('keydown', onMoreKeydown);
    restoreMoreBackground?.();
    restoreMoreBackground = null;
    moreOpener?.focus();
    moreOpener = null;
  }

  moreBtnEl.addEventListener('click', openMore);
  moreCloseBtnEl.addEventListener('click', closeMore);

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
    layersBtnEl.setAttribute('aria-label', t('layers', lang));
    moreBtnEl.setAttribute('aria-label', t('more', lang));
    moreTitleEl?.replaceChildren(document.createTextNode(t('more', lang)));
    moreCloseBtnEl.setAttribute('aria-label', t('close', lang));
    if (themeBtn) themeBtn.setAttribute('aria-label', t('themeToggle', lang));
    if (themeLabelEl) themeLabelEl.textContent = t('themeToggle', lang);
    if (langBtn) {
      langBtn.setAttribute(
        'aria-label',
        lang === 'id' ? t('switchToEn', lang) : t('switchToId', lang),
      );
    }
    if (langLabelEl) langLabelEl.textContent = lang === 'id' ? 'English' : 'Bahasa Indonesia';
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
    showToast(text, ms = 3000) {
      if (!toastEl) return;
      if (toastTimer !== null) clearTimeout(toastTimer);
      toastEl.textContent = text;
      toastEl.removeAttribute('hidden');
      toastTimer = setTimeout(() => {
        toastEl.setAttribute('hidden', '');
        toastEl.textContent = '';
        toastTimer = null;
      }, ms);
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
      if (themeIconEl) themeIconEl.innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
    },
    offlineBanner: offlineBannerEl,
    layersButton: layersBtnEl,
    openMore,
    closeMore,
  };
}
