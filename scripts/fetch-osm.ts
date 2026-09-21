import { basename, join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildQl, parseArgs, type OverpassResponse, type SourceFile } from './lib.ts';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// The plan's `area["ISO3166-2"="ID-JK"]` DOES work for DKI Jakarta; the initial
// probe with curl returned 406 only because curl (and Node's default fetch)
// sends no User-Agent, which Overpass rejects. Adding an explicit
// User-Agent header fixed it, so no fallback area filter was needed.
const UA = 'jalanin-fetch-osm/1.0 (+https://github.com/nizmitz/jalanin)';

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

async function main(): Promise<void> {
  const { source: sourcePath, only, out } = parseArgs(process.argv.slice(2));
  const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as SourceFile;
  const sourceName = basename(sourcePath).replace(/\.json$/, '');
  const outDir = out ?? join('data/raw', sourceName);
  mkdirSync(outDir, { recursive: true });

  for (const item of source.items) {
    if (only && only.size > 0 && !only.has(item.id)) continue;
    const query = buildQl(item, source);
    const data = await fetchOverpass(query);
    writeFileSync(join(outDir, `${item.id}.json`), JSON.stringify(data));
    console.log(item.id, `elements=${String(data.elements.length)}`);
    await new Promise((res) => setTimeout(res, 1500)); // be polite to Overpass
  }
}

try {
  await main();
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
