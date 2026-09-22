// About sheet (Task A10-lite): what the app is, where its data comes from, attribution,
// disclaimer, privacy, install hint, the offline download (also reachable from the old banner —
// see main.ts), and the "Lapor data salah" feedback link. Same sheet chrome and a11y as the layer
// panel (src/layers/panel.ts): reuses `.sheet` CSS and src/dialog.ts's focus trap/hideBackground.
import { escapeHtml } from './html';
import { buildIssueUrl } from './report';
import { listDataSources } from './data-sources';
import { freshness } from './freshness';
import { hideBackground, trapTabKey } from './dialog';
import { basemapCached, offlineSupported, prefetchBasemap } from './offline';
import { t } from './i18n';
import type { Lang } from './i18n';

export interface AboutOptions {
  lang: Lang;
  onClose: () => void;
  version: string;
  // Injected for tests so a fixed "now" can be asserted against a real data file's data_as_of
  // without waiting for it to actually go stale.
  now?: Date;
}

export interface About {
  open(): void;
  close(): void;
  setLang(lang: Lang): void;
}

export function mountAbout(root: HTMLElement, opts: AboutOptions): About {
  let lang = opts.lang;
  let opener: HTMLElement | null = null;
  let restoreBackground: (() => void) | null = null;

  const sheet = document.createElement('div');
  sheet.className = 'sheet about-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'about-sheet-title');
  sheet.hidden = true;
  root.appendChild(sheet);

  function sourceRowHtml(entry: ReturnType<typeof listDataSources>[number]): string {
    const stale = freshness(entry.asOf, opts.now) === 'stale';
    const badge = stale
      ? `<span class="badge badge--amber" data-badge>${escapeHtml(t('needsReview', lang))}</span>`
      : '';
    const href = entry.sources[0];
    const link = href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('sourceLink', lang))}</a>`
      : '';
    return `
      <tr data-source-row="${escapeHtml(entry.id)}">
        <th scope="row">${escapeHtml(t(entry.labelKey, lang))}</th>
        <td>${escapeHtml(entry.asOf)} ${badge}</td>
        <td>${link}</td>
      </tr>`;
  }

  function render(): void {
    const reportUrl = buildIssueUrl({ version: opts.version });
    const sources = listDataSources();
    sheet.innerHTML = `
      <div class="sheet__header">
        <h2 class="sheet__title" id="about-sheet-title">${escapeHtml(t('about', lang))}</h2>
        <button type="button" class="sheet__close" data-close aria-label="${escapeHtml(t('close', lang))}">✕</button>
      </div>
      <div class="sheet__body about-sheet__body">
        <section class="about-section">
          <p>${escapeHtml(t('tagline', lang))}</p>
          <p>${escapeHtml(t('whatItIsBody1', lang))}</p>
          <p>${escapeHtml(t('whatItIsBody2', lang))}</p>
        </section>
        <section class="about-section">
          <h3>${escapeHtml(t('dataSources', lang))}</h3>
          <table class="about-sources">
            <tbody>${sources.map(sourceRowHtml).join('')}</tbody>
          </table>
        </section>
        <section class="about-section">
          <p class="about-attribution">${escapeHtml(t('attributionText', lang))}</p>
          <p class="about-disclaimer">${escapeHtml(t('disclaimer', lang))}</p>
        </section>
        <section class="about-section">
          <h3>${escapeHtml(t('privacy', lang))}</h3>
          <p>${escapeHtml(t('privacyBody', lang))}</p>
        </section>
        <section class="about-section">
          <p>${escapeHtml(t('installHint', lang))}</p>
          <p>${escapeHtml(t('installHintIOS', lang))}</p>
          <p>${escapeHtml(t('installHintAndroid', lang))}</p>
          <div data-offline-slot></div>
        </section>
        <section class="about-section">
          <a class="about-report" data-report-link href="${escapeHtml(reportUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('reportData', lang))}</a>
        </section>
        <p class="about-version">Jalanin v${escapeHtml(opts.version)}</p>
      </div>
    `;
    wireOfflineDownload();
    wireClose();
  }

  function wireClose(): void {
    sheet.querySelector<HTMLButtonElement>('[data-close]')?.addEventListener('click', () => {
      close();
      opts.onClose();
    });
  }

  // Mirrors main.ts's own offline-banner download flow (kept untouched there) so the About sheet
  // offers the same download without the two copies needing to share state.
  function wireOfflineDownload(): void {
    const slot = sheet.querySelector<HTMLDivElement>('[data-offline-slot]');
    if (!slot || !offlineSupported()) return;

    function renderButton(): void {
      if (!slot) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'offline-banner__btn';
      btn.textContent = t('downloadMap', lang);
      btn.addEventListener('click', () => {
        btn.disabled = true;
        void runDownload();
      });
      slot.replaceChildren(btn);
    }

    async function runDownload(): Promise<void> {
      if (!slot) return;
      const progress = document.createElement('span');
      progress.textContent = t('downloading', lang);
      slot.replaceChildren(progress);
      try {
        await prefetchBasemap((pct) => {
          progress.textContent = `${t('downloading', lang)} ${String(pct)}%`;
        });
        progress.textContent = t('mapReady', lang);
      } catch {
        progress.textContent = t('downloadFailed', lang);
        renderButton();
      }
    }

    void basemapCached().then((cached) => {
      if (cached) {
        const span = document.createElement('span');
        span.textContent = t('offlineReady', lang);
        slot.replaceChildren(span);
      } else {
        renderButton();
      }
    });
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      opts.onClose();
      return;
    }
    trapTabKey(sheet, e);
  }

  function open(): void {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    render();
    sheet.hidden = false;
    restoreBackground = hideBackground(sheet);
    document.addEventListener('keydown', onKeydown);
    sheet.querySelector<HTMLButtonElement>('[data-close]')?.focus();
  }

  function close(): void {
    sheet.hidden = true;
    document.removeEventListener('keydown', onKeydown);
    restoreBackground?.();
    restoreBackground = null;
    opener?.focus();
    opener = null;
  }

  render();

  return {
    open,
    close,
    setLang(next) {
      lang = next;
      render();
    },
  };
}
