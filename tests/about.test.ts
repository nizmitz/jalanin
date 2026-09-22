import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountAbout } from '../src/about';

let root: HTMLElement;
let opener: HTMLButtonElement;

beforeEach(() => {
  root = document.createElement('div');
  document.body.appendChild(root);
  opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();
});

describe('mountAbout', () => {
  it('is a labelled, modal dialog', () => {
    mountAbout(root, { lang: 'id', onClose: vi.fn(), version: '0.2.0' });
    const sheet = root.querySelector('.sheet');
    expect(sheet?.getAttribute('role')).toBe('dialog');
    expect(sheet?.getAttribute('aria-modal')).toBe('true');
    expect(sheet?.getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('renders one data-source row per entry, each with a name and an as-of date', () => {
    mountAbout(root, { lang: 'id', onClose: vi.fn(), version: '0.2.0' });
    const rows = root.querySelectorAll('[data-source-row]');
    expect(rows.length).toBeGreaterThan(0);
    const gageRow = [...rows].find((r) => r.getAttribute('data-source-row') === 'gage');
    expect(gageRow).toBeTruthy();
    expect(gageRow?.textContent).toMatch(/\d{4}-\d{2}-\d{2}|unknown/);
  });

  it('flags a data source older than 180 days with the amber "perlu dicek" badge', () => {
    const now = new Date('2026-09-22T00:00:00Z');
    mountAbout(root, { lang: 'id', onClose: vi.fn(), version: '0.2.0', now });
    const gageRow = root.querySelector('[data-source-row="gage"]');
    // gage's data_as_of in the fixture data is 2026-09-20, well within 180 days of `now` — fresh.
    expect(gageRow?.querySelector('[data-badge]')).toBeNull();
  });

  it('shows the badge for an entry whose as_of is more than 180 days before `now`', () => {
    // Far enough in the future that every real data file's as_of reads as stale.
    const now = new Date('2030-01-01T00:00:00Z');
    mountAbout(root, { lang: 'id', onClose: vi.fn(), version: '0.2.0', now });
    const gageRow = root.querySelector('[data-source-row="gage"]');
    const badge = gageRow?.querySelector('[data-badge]');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('Perlu dicek');
  });

  it('links each data source to its source URL, opened in a new tab without an opener', () => {
    mountAbout(root, { lang: 'id', onClose: vi.fn(), version: '0.2.0' });
    const link = root.querySelector<HTMLAnchorElement>('[data-source-row="gage"] a');
    expect(link).toBeTruthy();
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noopener');
    expect(link?.href).toMatch(/^https?:\/\//);
  });

  it('shows the app version', () => {
    mountAbout(root, { lang: 'id', onClose: vi.fn(), version: '0.2.0' });
    expect(root.textContent).toContain('Jalanin v0.2.0');
  });

  it('builds the "Lapor data salah" link with the data issue template', () => {
    mountAbout(root, { lang: 'id', onClose: vi.fn(), version: '0.2.0' });
    const link = root.querySelector<HTMLAnchorElement>('[data-report-link]');
    expect(link).toBeTruthy();
    expect(link?.href).toContain('github.com/nizmitz/jalanin/issues/new');
    expect(link?.href).toContain('template=data.yml');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noopener');
  });

  it('shows the disclaimer and privacy copy', () => {
    mountAbout(root, { lang: 'id', onClose: vi.fn(), version: '0.2.0' });
    expect(root.textContent).toContain('Bukan sumber resmi');
    expect(root.textContent).toContain('Tidak ada pelacakan');
  });

  it('Escape closes, calls onClose, and returns focus to the opener', () => {
    const onClose = vi.fn();
    const about = mountAbout(root, { lang: 'id', onClose, version: '0.2.0' });
    about.open();
    expect(root.querySelector('.sheet')?.hasAttribute('hidden')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(root.querySelector('.sheet')?.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  it('setLang re-renders in the new language', () => {
    const about = mountAbout(root, { lang: 'id', onClose: vi.fn(), version: '0.2.0' });
    expect(root.textContent).toContain('Bukan sumber resmi');
    about.setLang('en');
    expect(root.textContent).toContain('Not an official source');
  });
});
