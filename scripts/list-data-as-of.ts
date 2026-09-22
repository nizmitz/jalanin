// Prints a markdown table of every committed data file and the date its contents were captured,
// so the quarterly review issue (.github/workflows/curated-review.yml) says what needs checking.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['data', 'src/data'];
const STALE_DAYS = 180;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'raw') continue; // gitignored fetch output
      out.push(...walk(path));
    } else if (path.endsWith('.json') || path.endsWith('.geojson')) {
      out.push(path);
    }
  }
  return out;
}

interface Dated {
  data_as_of?: unknown;
  as_of?: unknown;
  properties?: { data_as_of?: unknown };
}

function asOfOf(path: string): string | null {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Dated;
  const value = parsed.properties?.data_as_of ?? parsed.data_as_of ?? parsed.as_of;
  return typeof value === 'string' ? value : null;
}

const today = new Date();
const rows: string[] = [];
for (const root of ROOTS) {
  for (const path of walk(root)) {
    const asOf = asOfOf(path);
    if (asOf === null) continue;
    const days = Math.floor((today.getTime() - new Date(asOf).getTime()) / 86_400_000);
    const flag = Number.isNaN(days) || days > STALE_DAYS ? ' **perlu dicek**' : '';
    rows.push(`| \`${path}\` | ${asOf} | ${String(days)}${flag} |`);
  }
}

console.log('| File | Data as of | Umur (hari) |');
console.log('| --- | --- | --- |');
for (const row of rows.sort()) console.log(row);
console.log('');
console.log(
  `Ambang perlu dicek: ${String(STALE_DAYS)} hari. Perbarui lewat \`make layers\` atau edit manual, lalu tutup issue ini.`,
);
