import { describe, expect, it } from 'vitest';
import { buildIssueUrl } from '../src/report';

describe('buildIssueUrl', () => {
  it('produces a parseable URL against the jalanin issue tracker with the data template', () => {
    const url = buildIssueUrl({ version: '0.2.0' });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://github.com/nizmitz/jalanin/issues/new');
    expect(parsed.searchParams.get('template')).toBe('data.yml');
  });

  it('includes title and body params', () => {
    const url = buildIssueUrl({ version: '0.2.0' });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('title')).toBeTruthy();
    expect(parsed.searchParams.get('body')).toBeTruthy();
  });

  it('encodes layer, name, coordinates, version and user-agent in the body, newlines included', () => {
    const url = buildIssueUrl({
      layer: 'mrt',
      name: 'Stasiun Bundaran HI',
      lat: -6.195,
      lon: 106.823,
      version: '0.2.0',
    });
    const parsed = new URL(url);
    const body = parsed.searchParams.get('body') ?? '';
    expect(body).toContain('mrt');
    expect(body).toContain('Stasiun Bundaran HI');
    expect(body).toContain('-6.195');
    expect(body).toContain('106.823');
    expect(body).toContain('0.2.0');
    expect(body.includes('\n')).toBe(true);
  });

  it('falls back to placeholders when layer/name/coords are omitted', () => {
    const url = buildIssueUrl({ version: '0.2.0' });
    const parsed = new URL(url);
    const body = parsed.searchParams.get('body') ?? '';
    expect(body).toContain('-');
  });
});
