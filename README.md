# Jalanin

A mobile-first, offline-capable map for driving in Jakarta: the 25 "ganjil-genap"
(odd-even) roads, plus MRT, LRT, KRL and Transjakarta lines and stations. Shows whether
each gage road is restricted right now, follows your GPS with heading-up rotation, and
warns you 30 m before entering a gage road during active hours. Runs entirely in the
browser -- no backend, no accounts, no tracking.

## Layers

| Layer                          | Source                                   | Rebuild        |
| ------------------------------ | ---------------------------------------- | -------------- |
| Gage (odd-even)                | OSM road geometry + curated 25-road list | `make gage`    |
| MRT / LRT / KRL / Transjakarta | OSM `route_master` relations             | `make transit` |

Every layer file records the date its contents were captured; the about sheet lists them
and flags anything older than 180 days, and a quarterly workflow opens a review issue.

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

Data is not fetched at runtime -- it is versioned in the repo and rebuilt on demand:

- **Roads** (`data/sources/gage.json`, `data/gage.geojson`): if the official 25-road list
  changes, edit `data/sources/gage.json` then run `make gage` (`scripts/fetch-osm.ts` +
  `scripts/build-gage.ts`) to regenerate `data/gage.geojson`.
- **Hours** (`src/gage.ts`, `HOURS`): edit directly if the gage time windows change.
- **Holidays** (`src/data/holidays-2026.json`): add next year's holiday list before
  January 1 and wire it into `src/holidays.ts`.
- **Transit** (`data/sources/transit.json`, `data/layers/*.geojson`): run `make transit`
  to refetch route masters from OSM and rebuild the four layer files.

Rebuild scripts stamp `data_as_of` themselves. After any data change run `npm test`
(the layer tests assert size caps and feature counts) and re-deploy.

## Deploy

See [`deploy/README.md`](deploy/README.md) for the droplet runbook. CI builds and
publishes the container image to `ghcr.io/nizmitz/jalanin`; deploying a new
version on the droplet is a manual `docker compose pull && docker compose up -d`.
