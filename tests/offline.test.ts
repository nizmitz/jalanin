import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  basemapCached,
  clearBasemap,
  offlineSupported,
  prefetchBasemap,
  storageEstimate,
} from '../src/offline';

const CACHE_NAME = 'basemap-v1';
const BODY_BYTES = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

function keyOf(request: RequestInfo | URL): string {
  if (typeof request === 'string') return request;
  return request instanceof Request ? request.url : request.toString();
}

// Minimal in-memory stand-in for the Cache Storage API: jsdom has no `caches` global, and the
// real implementation only needs open/match/put/keys/delete for what offline.ts calls.
class FakeCache {
  store = new Map<string, Response>();
  put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.store.set(keyOf(request), response);
    return Promise.resolve();
  }
  match(request: RequestInfo | URL): Promise<Response | undefined> {
    return Promise.resolve(this.store.get(keyOf(request)));
  }
  keys(): Promise<readonly Request[]> {
    return Promise.resolve([...this.store.keys()].map((k) => new Request(k)));
  }
  delete(request: RequestInfo | URL): Promise<boolean> {
    return Promise.resolve(this.store.delete(keyOf(request)));
  }
}

class FakeCacheStorage {
  caches = new Map<string, FakeCache>();
  open(name: string): Promise<FakeCache> {
    let c = this.caches.get(name);
    if (!c) {
      c = new FakeCache();
      this.caches.set(name, c);
    }
    return Promise.resolve(c);
  }
  delete(name: string): Promise<boolean> {
    return Promise.resolve(this.caches.delete(name));
  }
}

function fakeFetchResponse(): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Split into two chunks so progress reporting has more than one step to observe.
      controller.enqueue(BODY_BYTES.slice(0, 3));
      controller.enqueue(BODY_BYTES.slice(3));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Length': String(BODY_BYTES.length),
      'Content-Type': 'application/octet-stream',
      'Accept-Ranges': 'bytes',
    },
  });
}

let fakeCaches: FakeCacheStorage;

beforeEach(() => {
  fakeCaches = new FakeCacheStorage();
  vi.stubGlobal('caches', fakeCaches);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(fakeFetchResponse())),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('basemapCached', () => {
  it('is false before anything is cached', async () => {
    expect(await basemapCached()).toBe(false);
  });

  it('is true once prefetchBasemap has run', async () => {
    await prefetchBasemap(() => undefined);
    expect(await basemapCached()).toBe(true);
  });
});

describe('prefetchBasemap', () => {
  it('caches a status-200 response for /jakarta.pmtiles', async () => {
    await prefetchBasemap(() => undefined);
    const cache = await fakeCaches.open(CACHE_NAME);
    const cached = await cache.match('/jakarta.pmtiles');
    expect(cached).toBeDefined();
    expect(cached?.status).toBe(200);
  });

  it('reports progress reaching 100', async () => {
    const seen: number[] = [];
    await prefetchBasemap((pct) => seen.push(pct));
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.at(-1)).toBe(100);
  });

  it('caches a body whose bytes exactly match the fetched source (streamed, not re-buffered)', async () => {
    await prefetchBasemap(() => undefined);
    const cache = await fakeCaches.open(CACHE_NAME);
    const cached = await cache.match('/jakarta.pmtiles');
    const buf = await cached?.arrayBuffer();
    expect(buf).toBeDefined();
    expect(new Uint8Array(buf ?? new ArrayBuffer(0))).toEqual(BODY_BYTES);
  });
});

describe('clearBasemap', () => {
  it('empties the basemap cache', async () => {
    await prefetchBasemap(() => undefined);
    expect(await basemapCached()).toBe(true);
    await clearBasemap();
    expect(await basemapCached()).toBe(false);
  });
});

describe('storageEstimate', () => {
  it('reads navigator.storage.estimate', async () => {
    vi.stubGlobal('navigator', {
      storage: { estimate: () => Promise.resolve({ usage: 10, quota: 100 }) },
    });
    expect(await storageEstimate()).toEqual({ usage: 10, quota: 100 });
  });
});

describe('offlineSupported', () => {
  it('is false when the Cache API is missing (insecure context)', () => {
    vi.stubGlobal('caches', undefined);
    expect(offlineSupported()).toBe(false);
    vi.unstubAllGlobals();
  });
});
