# Jalanin

A mobile-first, offline-capable map of Jakarta's 25 "ganjil-genap" (odd-even) roads.
Shows whether each road is currently restricted, follows your GPS with heading-up
rotation, and warns you 30 m before entering a gage road during active hours. Runs
entirely in the browser -- no backend, no accounts, no tracking.

Built with MapLibre GL JS on a self-hosted PMTiles basemap (Protomaps), so the whole
map works offline once installed as a PWA.

## Dev setup

```sh
make basemap   # downloads jakarta.pmtiles + basemap-assets into public/ (gitignored)
npm ci
npm run dev
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`, `npm run typecheck`,
`npm test`.

## Updating the data

The gage rules are not scraped live -- they are manually curated and versioned in the repo:

- **Roads** (`data/sources/gage.json`, `data/gage.geojson`): if the official 25-road list
  changes, edit `data/sources/gage.json` then run `make gage` (`scripts/fetch-osm.ts` +
  `scripts/build-gage.ts`) to regenerate `data/gage.geojson`.
- **Hours** (`src/gage.ts`, `HOURS`): edit directly if the gage time windows change.
- **Holidays** (`src/data/holidays-2026.json`): add next year's holiday list before
  January 1 and wire it into `src/holidays.ts`.

After any data change, bump the "data as of" date shown in the UI footer, run
`npm test`, and re-deploy.

## Deploy

See [`deploy/README.md`](deploy/README.md) for the droplet runbook. CI builds and
publishes the container image to `ghcr.io/nizmitz/jalanin`; deploying a new
version on the droplet is a manual `docker compose pull && docker compose up -d`.
