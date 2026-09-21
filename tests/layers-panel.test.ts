import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountLayerPanel } from '../src/layers/panel';
import type { LayerDef } from '../src/layers/types';

function def(id: string, group: LayerDef['group'], labelKey: LayerDef['labelKey']): LayerDef {
  return {
    id,
    group,
    labelKey,
    defaultOn: true,
    data: { type: 'FeatureCollection', features: [] },
    layers: () => [],
  };
}

let root: HTMLElement;
let opener: HTMLButtonElement;

beforeEach(() => {
  root = document.createElement('div');
  document.body.appendChild(root);
  opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();
});

describe('mountLayerPanel', () => {
  it('renders groups in order Rules, Transit, Road, Hazard, with gage first among rules', () => {
    const gage = def('gage', 'rules', 'layerGage');
    const krl = def('krl', 'transit', 'layerKrl');
    const toll = def('toll', 'road', 'layerToll');
    const flood = def('flood', 'hazard', 'layerFlood');
    mountLayerPanel(root, {
      lang: 'id',
      enabled: new Set(['gage', 'krl', 'toll', 'flood']),
      defs: [flood, toll, krl, gage],
      onToggle: vi.fn(),
      onClose: vi.fn(),
    });

    const headings = [...root.querySelectorAll('.layer-group__title')].map((h) => h.textContent);
    expect(headings).toEqual(['Aturan', 'Transportasi umum', 'Jalan', 'Bahaya']);

    const names = [...root.querySelectorAll('.layer-row__name')].map((n) => n.textContent);
    expect(names[0]).toBe('Ganjil-genap'); // gage first
  });

  it('hides empty groups', () => {
    mountLayerPanel(root, {
      lang: 'id',
      enabled: new Set(),
      defs: [def('gage', 'rules', 'layerGage')],
      onToggle: vi.fn(),
      onClose: vi.fn(),
    });
    expect(root.querySelectorAll('.layer-group').length).toBe(1);
  });

  it('toggling a row checkbox calls onToggle with the new state', () => {
    const onToggle = vi.fn();
    mountLayerPanel(root, {
      lang: 'id',
      enabled: new Set(['a']),
      defs: [def('a', 'transit', 'layerMrt')],
      onToggle,
      onClose: vi.fn(),
    });
    const checkbox = root.querySelector<HTMLInputElement>('.layer-row input');
    if (!checkbox) throw new Error('checkbox not rendered');
    expect(checkbox.checked).toBe(true);
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    expect(onToggle).toHaveBeenCalledWith('a', false);
  });

  it('Escape closes the panel, calls onClose, and returns focus to the opener', () => {
    const onClose = vi.fn();
    const panel = mountLayerPanel(root, {
      lang: 'id',
      enabled: new Set(),
      defs: [def('a', 'transit', 'layerMrt')],
      onToggle: vi.fn(),
      onClose,
    });

    panel.open();
    expect(root.querySelector('.sheet')?.hasAttribute('hidden')).toBe(false);
    expect(document.activeElement).not.toBe(opener);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(root.querySelector('.sheet')?.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  it('Tab from the last focusable element cycles back to the first', () => {
    const panel = mountLayerPanel(root, {
      lang: 'id',
      enabled: new Set(),
      defs: [def('a', 'transit', 'layerMrt'), def('b', 'transit', 'layerLrt')],
      onToggle: vi.fn(),
      onClose: vi.fn(),
    });
    panel.open();

    const focusable = [...root.querySelectorAll<HTMLElement>('.sheet__close, .layer-row input')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    expect(focusable.length).toBeGreaterThan(1);

    last?.focus();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(first);

    // Shift+Tab from the first element wraps back to the last.
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(last);
  });

  it('inerts the opener while open and restores it on close', () => {
    const panel = mountLayerPanel(root, {
      lang: 'id',
      enabled: new Set(),
      defs: [def('a', 'transit', 'layerMrt')],
      onToggle: vi.fn(),
      onClose: vi.fn(),
    });

    panel.open();
    expect(opener.hasAttribute('inert')).toBe(true);
    expect(opener.getAttribute('aria-hidden')).toBe('true');

    panel.close();
    expect(opener.hasAttribute('inert')).toBe(false);
    expect(opener.hasAttribute('aria-hidden')).toBe(false);
  });

  it('is a labelled, modal dialog', () => {
    mountLayerPanel(root, {
      lang: 'id',
      enabled: new Set(),
      defs: [],
      onToggle: vi.fn(),
      onClose: vi.fn(),
    });
    const sheet = root.querySelector('.sheet');
    expect(sheet?.getAttribute('role')).toBe('dialog');
    expect(sheet?.getAttribute('aria-modal')).toBe('true');
    expect(sheet?.getAttribute('aria-labelledby')).toBeTruthy();
  });
});
