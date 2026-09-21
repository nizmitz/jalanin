import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync('index.html', 'utf-8');
const viteConfig = readFileSync('vite.config.ts', 'utf-8');

describe('branding', () => {
  it('index.html title is Jalanin', () => {
    expect(indexHtml).toMatch(/<title>Jalanin<\/title>/);
  });

  it('index.html has an Indonesian meta description', () => {
    const match = /<meta\s+name="description"\s+content="([^"]+)"/.exec(indexHtml);
    expect(match?.[1]).toBeTruthy();
  });

  it('manifest name and short_name are Jalanin', () => {
    expect(viteConfig).toMatch(/name:\s*'Jalanin'/);
    expect(viteConfig).toMatch(/short_name:\s*'Jalanin'/);
  });
});
