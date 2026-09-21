import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPartialResponse } from 'workbox-range-requests';

// jsdom's global `Blob` is a different class than the one its own `Response.blob()` actually
// returns (which comes from Node's underlying undici implementation), so workbox's
// `instanceof Blob` assertion fails against the jsdom class. Point the global at whichever Blob
// class Response.blob() really produces — a minimal polyfill, not a behavior change.
beforeEach(async () => {
  const probe = await new Response(new Uint8Array(1)).blob();
  vi.stubGlobal('Blob', probe.constructor);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Pins Review Focus item 5: once a full 200 response for /jakarta.pmtiles is sitting in the
// basemap-v1 cache, workbox's RangeRequestsPlugin (via this same createPartialResponse helper)
// must turn a Range: request into a 206 slice — this is the actual mechanism src/sw.ts relies on.
describe('createPartialResponse', () => {
  it('slices a full 200 response into a 206 for the requested byte range', async () => {
    const bytes = Uint8Array.from({ length: 64 }, (_, i) => i);
    const full = new Response(bytes, {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream', 'Accept-Ranges': 'bytes' },
    });
    const request = new Request('https://example.test/jakarta.pmtiles', {
      headers: { Range: 'bytes=8-15' },
    });

    const partial = await createPartialResponse(request, full);

    expect(partial.status).toBe(206);
    expect(partial.headers.get('Content-Range')).toBe('bytes 8-15/64');
    const body = new Uint8Array(await partial.arrayBuffer());
    expect(body).toEqual(bytes.slice(8, 16));
  });
});
