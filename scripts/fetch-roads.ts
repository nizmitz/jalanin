import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildQuery, type OverpassResponse } from './lib.ts';

interface Seg {
  id: string;
  name: string;
  group: string;
  osm: string;
  note?: string;
  clip?: [number, number, number, number];
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// The plan's `area["ISO3166-2"="ID-JK"]` DOES work for DKI Jakarta; the initial
// probe with curl returned 406 only because curl (and Node's default fetch)
// sends no User-Agent, which Overpass rejects. Adding an explicit
// User-Agent header fixed it, so no fallback area filter was needed.

const UA = 'jalanin-fetch-roads/1.0 (+https://github.com/nizmitz/jalanin)';

const segs = JSON.parse(readFileSync('data/segments.json', 'utf8')) as Seg[];
mkdirSync('data/raw', { recursive: true });

async function fetchOverpass(query: string): Promise<OverpassResponse> {
  let lastErr: unknown;
  for (const endpoint of ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'User-Agent': UA },
          body: 'data=' + encodeURIComponent(query),
        });
        if (res.status === 429 || res.status === 504) {
          lastErr = new Error(`${endpoint}: ${String(res.status)}`);
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        if (!res.ok) {
          throw new Error(`${endpoint}: ${String(res.status)} ${await res.text()}`);
        }
        return (await res.json()) as OverpassResponse;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('overpass fetch failed');
}

// Optional CLI args restrict the run to those segment ids, e.g.
// `npx tsx scripts/fetch-roads.ts fatmawati a-yani`.
const only = new Set(process.argv.slice(2));

async function main(): Promise<void> {
  for (const s of segs) {
    if (only.size > 0 && !only.has(s.id)) continue;
    const query = buildQuery(s.osm);
    const data = await fetchOverpass(query);
    writeFileSync(`data/raw/${s.id}.json`, JSON.stringify(data));
    console.log(s.id, `ways=${String(data.elements.length)}`);
    await new Promise((res) => setTimeout(res, 1500)); // be polite to Overpass
  }
}

await main();
