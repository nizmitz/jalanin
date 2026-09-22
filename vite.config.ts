/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  build: { target: 'es2022', sourcemap: false },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        // Fonts: precache only the Latin glyph ranges Jakarta labels actually need (0-255,
        // 256-511) for every weight/style; the other ~750 pbf ranges (Cyrillic, CJK, etc.) are
        // served on demand by the runtime CacheFirst route registered in sw.ts instead.
        globPatterns: [
          '**/*.{js,css,html,woff2,png,json,geojson}',
          'basemap-assets/fonts/*/{0-255,256-511}.pbf',
        ],
        globIgnores: ['**/jakarta.pmtiles'],
        maximumFileSizeToCacheInBytes: 5_000_000,
      },
      manifest: {
        name: 'Jalanin',
        short_name: 'Jalanin',
        description: 'Gage, tol, banjir, MRT — sekali lihat.',
        lang: 'id',
        display: 'standalone',
        start_url: '/',
        background_color: '#141414',
        theme_color: '#141414',
        icons: [
          { src: 'icons/192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
});
