import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import * as pmtiles from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';
import type { Theme } from './theme';

maplibregl.setWorkerUrl(workerUrl);
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

export const PMTILES_URL = `${location.origin}/jakarta.pmtiles`;
export const JAKARTA_CENTER: [number, number] = [106.8272, -6.2088];

export function buildStyle(theme: Theme): StyleSpecification {
  const flavor = theme === 'dark' ? 'black' : 'light';
  return {
    version: 8,
    glyphs: '/basemap-assets/fonts/{fontstack}/{range}.pbf',
    sprite: `${location.origin}/basemap-assets/sprites/v4/${theme}`,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${PMTILES_URL}`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: layers('protomaps', namedFlavor(flavor), { lang: 'id' }),
  };
}

export function createMap(container: HTMLElement, theme: Theme): maplibregl.Map {
  return new maplibregl.Map({
    container,
    style: buildStyle(theme),
    center: JAKARTA_CENTER,
    zoom: 11,
    attributionControl: { compact: true },
  });
}

export function applyTheme(map: maplibregl.Map, theme: Theme): void {
  map.setStyle(buildStyle(theme)); // callers re-add overlays on 'style.load'
}
