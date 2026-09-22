import { describe, expect, it } from 'vitest';
import { buildIssueUrl } from '../src/report';

describe('buildIssueUrl', () => {
  it('produces a parseable URL against the jalanin issue tracker with the data template', () => {
    const url = buildIssueUrl({ version: '0.2.0' });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://github.com/nizmitz/jalanin/issues/new');
    expect(parsed.searchParams.get('template')).toBe('data.yml');
  });

  it('includes title and the form field params', () => {
    const url = buildIssueUrl({ version: '0.2.0' });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('title')).toBeTruthy();
    // YAML issue forms are prefilled per field id, not through a single `body` param.
    expect(parsed.searchParams.get('layer')).toBe('lainnya');
    expect(parsed.searchParams.get('context')).toBeTruthy();
  });

  it('fills the form fields with layer, coordinates, name, version and user-agent', () => {
    const url = buildIssueUrl({
      layer: 'mrt',
      name: 'Stasiun Bundaran HI',
      lat: -6.195,
      lon: 106.823,
      version: '0.2.0',
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('layer')).toBe('mrt');
    expect(parsed.searchParams.get('where')).toBe('-6.195, 106.823');
    const context = parsed.searchParams.get('context') ?? '';
    expect(context).toContain('Stasiun Bundaran HI');
    expect(context).toContain('0.2.0');
    expect(context.includes('\n')).toBe(true);
  });

  it('falls back to placeholders when layer/name/coords are omitted', () => {
    const url = buildIssueUrl({ version: '0.2.0' });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('where')).toBe('-');
    expect(parsed.searchParams.get('context')).toContain('Nama: -');
  });
});
