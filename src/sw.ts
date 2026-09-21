/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { CacheFirst } from 'workbox-strategies';
import type { WorkboxPlugin } from 'workbox-core/types';

declare let self: ServiceWorkerGlobalScope;

// workbox's own plugin classes aren't compiled with exactOptionalPropertyTypes, so TS sees
// their optional callback properties as incompatible with the (stricter) WorkboxPlugin
// interface this project's tsconfig expects. The runtime shape is fine; only the declared
// types disagree, so a narrow cast at the boundary is the honest fix.
function asPlugin(plugin: object): WorkboxPlugin {
  return plugin;
}

void self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// PMTiles: serve byte ranges from the full cached file once prefetchBasemap() (src/offline.ts)
// has put one there; otherwise this route falls through to the network, which answers the
// range request itself (nginx supports Range on static files).
registerRoute(
  ({ url }) => url.pathname === '/jakarta.pmtiles',
  new CacheFirst({
    cacheName: 'basemap-v1',
    plugins: [
      asPlugin(new RangeRequestsPlugin()),
      {
        // RangeRequestsPlugin only satisfies ranges from a *full* cached response. A partial
        // (206) response cached here would silently break every later range read, so never
        // let anything but a complete 200 land in this cache.
        cacheWillUpdate: ({ response }) =>
          Promise.resolve(response.status === 200 ? response : null),
      },
    ],
  }),
);

// Basemap glyphs/sprites outside the precached Latin ranges (src/vite.config.ts globPatterns):
// cache on first use so re-visiting non-Latin text or re-fetching sprites doesn't hit the
// network again, without bloating the initial install with ~750 rarely-needed pbf files.
registerRoute(
  ({ url }) => url.pathname.startsWith('/basemap-assets/'),
  new CacheFirst({
    cacheName: 'basemap-assets-v1',
    plugins: [asPlugin(new ExpirationPlugin({ maxEntries: 200 }))],
  }),
);
