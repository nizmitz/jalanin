# Jalanin

Mobile-first static PWA (Vite + TS, MapLibre GL JS + PMTiles) showing Jakarta's
25 ganjil-genap roads. No backend; deployed as a static bundle behind nginx.

## Commands

- `npm ci` -- install
- `make basemap` -- fetch PMTiles + basemap assets into `public/` (gitignored, CI-only otherwise)
- `npm run dev` / `npm run build` / `npm run preview`
- `npm run lint` / `npm run typecheck` / `npm test`
- `pre-commit run --all-files` before every commit

## Data as of

Rules and geometry are manually curated, not scraped live:

- `src/gage.ts` `HOURS` -- gage hour windows (WIB); edit here if Pergub changes them.
- `src/data/holidays-2026.json` -- yearly holiday list; add a new year's file and wire it up
  in `src/holidays.ts` before Jan 1.
- `data/sources/gage.json` / `data/gage.geojson` -- the 25 road geometries; regenerate via
  `make gage` (`scripts/fetch-osm.ts` + `scripts/build-gage.ts`) if a road list changes.

## Deploy

See `deploy/README.md` for the droplet runbook (`maps.nizmitz.com`, ghost nginx reverse proxy).
CI publishes `ghcr.io/nizmitz/jalanin`; deploy is a manual `docker compose pull && up -d`.
