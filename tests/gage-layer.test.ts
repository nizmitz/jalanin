import { describe, expect, it } from 'vitest';
import { roadState } from '../src/gage-layer';
import { escapeHtml } from '../src/html';

describe('roadState', () => {
  it('avoid + active now -> blocked', () => {
    expect(roadState('avoid', true)).toBe('blocked');
  });
  it('avoid + not active now -> blocked-later', () => {
    expect(roadState('avoid', false)).toBe('blocked-later');
  });
  it('ok -> open regardless of active', () => {
    expect(roadState('ok', true)).toBe('open');
    expect(roadState('ok', false)).toBe('open');
  });
  it('off -> open regardless of active', () => {
    expect(roadState('off', true)).toBe('open');
    expect(roadState('off', false)).toBe('open');
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML-sensitive characters', () => {
    expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });
  it('leaves plain text untouched', () => {
    expect(escapeHtml('Jl. Gajah Mada')).toBe('Jl. Gajah Mada');
  });
});
