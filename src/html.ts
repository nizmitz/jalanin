// Shared with any module that builds HTML strings from untrusted feature properties (gage
// popups, layer popups): escape before interpolating into innerHTML/setHTML.
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
