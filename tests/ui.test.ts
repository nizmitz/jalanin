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
