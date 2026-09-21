import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountUi } from '../src/ui';

function deps() {
  return {
    initial: { parity: 'odd' as const, theme: 'dark' as const, lang: 'id' as const },
    onParity: vi.fn(),
    onFollow: vi.fn(),
    onTheme: vi.fn(),
    onLang: vi.fn(),
  };
}

let root: HTMLElement;

beforeEach(() => {
  root = document.createElement('div');
  document.body.appendChild(root);
});

describe('mountUi', () => {
  it('renders both parity segments', () => {
    mountUi(root, deps());
    expect(root.querySelector('[data-parity="odd"]')).not.toBeNull();
    expect(root.querySelector('[data-parity="even"]')).not.toBeNull();
  });

  it('calls onParity("even") when the Genap segment is clicked', () => {
    const d = deps();
    mountUi(root, d);
    const even = root.querySelector<HTMLButtonElement>('[data-parity="even"]');
    even?.click();
    expect(d.onParity).toHaveBeenCalledWith('even');
  });

  it('calls onParity("odd") when the Ganjil segment is clicked', () => {
    const d = deps();
    mountUi(root, d);
    const odd = root.querySelector<HTMLButtonElement>('[data-parity="odd"]');
    odd?.click();
    expect(d.onParity).toHaveBeenCalledWith('odd');
  });

  it('calls onFollow, onTheme, onLang when their buttons are clicked', () => {
    const d = deps();
    mountUi(root, d);
    root.querySelector<HTMLButtonElement>('[data-action="follow"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="theme"]')?.click();
    root.querySelector<HTMLButtonElement>('[data-action="lang"]')?.click();
    expect(d.onFollow).toHaveBeenCalledTimes(1);
    expect(d.onTheme).toHaveBeenCalledTimes(1);
    expect(d.onLang).toHaveBeenCalledTimes(1);
  });

  it('showAlert(null) hides the alert banner', () => {
    const ui = mountUi(root, deps());
    const banner = root.querySelector('[data-alert]');
    ui.showAlert('Masuk Sudirman');
    expect(banner?.hasAttribute('hidden')).toBe(false);
    ui.showAlert(null);
    expect(banner?.hasAttribute('hidden')).toBe(true);
  });

  it('setStatus("avoid", true) sets a chip class containing "no"', () => {
    const ui = mountUi(root, deps());
    ui.setStatus('avoid', true, 'weekday');
    const chip = root.querySelector('[data-status]');
    expect(chip?.className).toMatch(/\bno\b|-no\b/);
  });

  it('setStatus("ok", true) sets a chip class containing "ok"', () => {
    const ui = mountUi(root, deps());
    ui.setStatus('ok', true, 'weekday');
    const chip = root.querySelector('[data-status]');
    expect(chip?.className).toMatch(/\bok\b|-ok\b/);
  });

  it('setFollow(true) marks the follow button active', () => {
    const ui = mountUi(root, deps());
    ui.setFollow(true);
    const followBtn = root.querySelector('[data-action="follow"]');
    expect(followBtn?.getAttribute('aria-pressed')).toBe('true');
    ui.setFollow(false);
    expect(followBtn?.getAttribute('aria-pressed')).toBe('false');
  });

  it('showToast shows text and auto-clears after the given duration', () => {
    vi.useFakeTimers();
    const ui = mountUi(root, deps());
    const toast = root.querySelector('[data-toast]');
    ui.showToast('Peta siap offline', 3000);
    expect(toast?.textContent).toBe('Peta siap offline');
    expect(toast?.hasAttribute('hidden')).toBe(false);
    vi.advanceTimersByTime(2999);
    expect(toast?.hasAttribute('hidden')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(toast?.hasAttribute('hidden')).toBe(true);
    vi.useRealTimers();
  });

  it('showToast does not clear an unrelated alert set via showAlert', () => {
    vi.useFakeTimers();
    const ui = mountUi(root, deps());
    ui.showToast('Peta siap offline', 1000);
    ui.showAlert('Masuk Sudirman');
    vi.advanceTimersByTime(1000);
    const alert = root.querySelector('[data-alert]');
    expect(alert?.hasAttribute('hidden')).toBe(false);
    expect(alert?.textContent).toBe('Masuk Sudirman');
    vi.useRealTimers();
  });

  it('setLang swaps visible copy', () => {
    const ui = mountUi(root, deps());
    ui.setLang('en');
    const odd = root.querySelector('[data-parity="odd"]');
    expect(odd?.textContent).toMatch(/odd/i);
    ui.setLang('id');
    expect(odd?.textContent).toMatch(/ganjil/i);
  });
});

describe('mountUi initial state', () => {
  it('reflects the initial parity, theme and lang without a later set call', () => {
    mountUi(root, {
      ...deps(),
      initial: { parity: 'even', theme: 'light', lang: 'en' },
    });
    expect(root.querySelector('[data-parity="even"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('[data-parity="odd"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(root.querySelector('[data-action="theme"]')?.getAttribute('aria-label')).toBe(
      'Switch theme',
    );
    expect(root.querySelector('[data-status]')?.getAttribute('aria-live')).toBe('polite');
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('mountUi FAB set', () => {
  it('shows exactly 3 fabs: follow, layers, more', () => {
    mountUi(root, deps());
    const fabs = [...root.querySelectorAll('.fab-stack > .fab')];
    expect(fabs.map((b) => b.getAttribute('data-action'))).toEqual(['follow', 'layers', 'more']);
  });

  it('exposes a layersButton element with an aria-label', () => {
    const ui = mountUi(root, deps());
    expect(ui.layersButton).toBeInstanceOf(HTMLButtonElement);
    expect(ui.layersButton.getAttribute('aria-label')).toBeTruthy();
  });

  it('theme, lang, share and about live inside the more sheet, share/about hidden for now', () => {
    mountUi(root, deps());
    const sheet = root.querySelector('.more-sheet');
    expect(sheet?.querySelector('[data-action="theme"]')).not.toBeNull();
    expect(sheet?.querySelector('[data-action="lang"]')).not.toBeNull();
    expect(sheet?.querySelector('[data-action="share"]')?.hasAttribute('hidden')).toBe(true);
    expect(sheet?.querySelector('[data-action="about"]')?.hasAttribute('hidden')).toBe(true);
  });

  it('openMore shows the more sheet as a labelled modal dialog and moves focus into it', () => {
    const ui = mountUi(root, deps());
    const sheet = root.querySelector('.more-sheet');
    expect(sheet?.getAttribute('role')).toBe('dialog');
    expect(sheet?.getAttribute('aria-modal')).toBe('true');
    expect(sheet?.hasAttribute('hidden')).toBe(true);

    ui.openMore();

    expect(sheet?.hasAttribute('hidden')).toBe(false);
    expect(sheet?.contains(document.activeElement)).toBe(true);
  });

  it('closeMore hides the sheet; Escape closes it and returns focus to the opener', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const ui = mountUi(root, deps());
    const sheet = root.querySelector('.more-sheet');

    ui.openMore();
    expect(sheet?.hasAttribute('hidden')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(sheet?.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(opener);

    ui.openMore();
    ui.closeMore();
    expect(sheet?.hasAttribute('hidden')).toBe(true);
  });

  it('Tab from the last focusable element in the more sheet cycles back to the first', () => {
    const ui = mountUi(root, deps());
    const sheet = root.querySelector<HTMLElement>('.more-sheet');
    if (!sheet) throw new Error('more sheet not rendered');

    ui.openMore();

    // share/about are hidden for now, so close/theme/lang are the only focusable elements.
    const focusable = [
      ...sheet.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([hidden]), [data-more-close]',
      ),
    ];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    expect(focusable.length).toBeGreaterThan(1);

    last?.focus();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(first);
  });

  it('inerts the opener while the more sheet is open and restores it on close', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const ui = mountUi(root, deps());
    ui.openMore();
    expect(opener.hasAttribute('inert')).toBe(true);
    expect(opener.getAttribute('aria-hidden')).toBe('true');

    ui.closeMore();
    expect(opener.hasAttribute('inert')).toBe(false);
    expect(opener.hasAttribute('aria-hidden')).toBe(false);
  });
});
