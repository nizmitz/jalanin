// Basemap prefetch/eviction for offline use. The service worker (src/sw.ts) only range-caches
// /jakarta.pmtiles once a *full* 200 response is present in this cache — see the note on
// CacheFirst + RangeRequestsPlugin there. This module is what puts that full response in place.

const CACHE_NAME = 'basemap-v1';
const BASEMAP_URL = '/jakarta.pmtiles';

export async function prefetchBasemap(onProgress: (pct: number) => void): Promise<void> {
  const res = await fetch(BASEMAP_URL);
  if (!res.ok || !res.body) throw new Error(`fetch ${BASEMAP_URL} failed: ${String(res.status)}`);

  const contentLength = Number(res.headers.get('Content-Length') ?? '0');
  let loaded = 0;

  // Pipe straight from the network stream into the cached Response instead of buffering the
  // whole ~80 MB file (once in the reader loop, again concatenating chunks, again inside
  // `new Response`): this counts bytes as they pass through without holding a second copy.
  const counted = res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        loaded += chunk.byteLength;
        if (contentLength > 0)
          onProgress(Math.min(100, Math.round((loaded / contentLength) * 100)));
        controller.enqueue(chunk);
      },
    }),
  );

  const headers = new Headers();
  const contentType = res.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  if (contentLength > 0) headers.set('Content-Length', String(contentLength));
  headers.set('Accept-Ranges', res.headers.get('Accept-Ranges') ?? 'bytes');

  const cache = await caches.open(CACHE_NAME);
  await cache.put(BASEMAP_URL, new Response(counted, { status: 200, headers }));
  onProgress(100);
}

// Cache Storage only exists in secure contexts (https, localhost). On plain http the app still
// runs, it just cannot go offline.
export function offlineSupported(): boolean {
  return typeof caches !== 'undefined' && 'serviceWorker' in navigator;
}

export async function basemapCached(): Promise<boolean> {
  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(BASEMAP_URL);
  return match !== undefined;
}

export async function storageEstimate(): Promise<{ usage: number; quota: number }> {
  if (typeof navigator.storage === 'undefined') return { usage: 0, quota: 0 };
  const estimate = await navigator.storage.estimate();
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}

export async function clearBasemap(): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(BASEMAP_URL);
}
