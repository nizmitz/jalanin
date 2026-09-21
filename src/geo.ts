import * as maplibregl from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';

export interface Fix {
  lon: number;
  lat: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  t: number;
}

const EARTH_RADIUS_M = 6_371_000;
const MOVED_THRESHOLD_M = 5;
const MOVING_SPEED_MS = 1;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

// Haversine great-circle distance in meters.
export function distanceM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

// Initial bearing (degrees, 0-360, 0 = north) from point 1 to point 2.
export function bearingBetween(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLambda = toRad(lon2 - lon1);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Ring of `steps` points (plus a closing point) around (lon, lat) at radiusM, for drawing an
// accuracy circle as a filled polygon.
export function circlePolygon(
  lon: number,
  lat: number,
  radiusM: number,
  steps = 32,
): [number, number][] {
  const metersPerDegreeLon = 111_320 * Math.cos(toRad(lat));
  const metersPerDegreeLat = 110_540;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLon = (radiusM * Math.sin(angle)) / metersPerDegreeLon;
    const dLat = (radiusM * Math.cos(angle)) / metersPerDegreeLat;
    ring.push([lon + dLon, lat + dLat]);
  }
  return ring;
}

// GPS heading while moving; otherwise the bearing from the previous fix if it moved enough to
// be meaningful; otherwise null (caller should fall back to compass or leave bearing unchanged).
// A real speed with a null heading (e.g. a cold fix) falls through to the prev-distance
// computation instead of giving up.
export function bearingForFollow(f: Fix, prev: Fix | null): number | null {
  if (f.speed !== null && f.speed > MOVING_SPEED_MS && f.heading !== null) return f.heading;
  if (prev) {
    const moved = distanceM(prev.lon, prev.lat, f.lon, f.lat);
    if (moved > MOVED_THRESHOLD_M) return bearingBetween(prev.lon, prev.lat, f.lon, f.lat);
  }
  return null;
}

const WATCH_OPTS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 1000,
  timeout: 10_000,
};

function toFix(pos: GeolocationPosition): Fix {
  const c = pos.coords;
  return {
    lon: c.longitude,
    lat: c.latitude,
    accuracy: c.accuracy,
    heading: c.heading !== null && !Number.isNaN(c.heading) ? c.heading : null,
    speed: c.speed !== null && !Number.isNaN(c.speed) ? c.speed : null,
    t: pos.timestamp,
  };
}

// Starts the browser's geolocation watch and returns a function that stops it.
export function startWatch(
  onFix: (f: Fix) => void,
  onError: (e: GeolocationPositionError) => void,
): () => void {
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      onFix(toFix(pos));
    },
    onError,
    WATCH_OPTS,
  );
  return () => {
    navigator.geolocation.clearWatch(id);
  };
}

interface DeviceOrientationEventStatic {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

interface CompassOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

// iOS-only compass fallback, used when GPS heading is unavailable (e.g. standing still).
// Must be called from inside a user-gesture handler on iOS 13+ so the permission prompt fires.
export function startCompass(cb: (heading: number) => void): () => void {
  // Desktop browsers may not define the constructor at all; no compass there.
  const ctor = (globalThis as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent;
  if (ctor === undefined) return () => undefined;
  const iosCtor = ctor as DeviceOrientationEventStatic;

  // Guards against the iOS permission promise resolving after the caller already cleaned up
  // (e.g. follow was stopped again before the user answered the prompt) — without this the
  // listener would attach anyway and never get removed.
  let cancelled = false;

  function onOrientation(e: DeviceOrientationEvent): void {
    const compassEvent = e as CompassOrientationEvent;
    // Relative (non-absolute) `alpha` is not north-referenced, so only trust it when the
    // device reports an absolute orientation; webkitCompassHeading is always north-referenced.
    const heading =
      compassEvent.webkitCompassHeading !== undefined
        ? compassEvent.webkitCompassHeading
        : e.absolute && e.alpha !== null
          ? 360 - e.alpha
          : null;
    if (heading !== null) cb(heading);
  }

  if (typeof iosCtor.requestPermission === 'function') {
    iosCtor
      .requestPermission()
      .then((state) => {
        if (!cancelled && state === 'granted')
          window.addEventListener('deviceorientation', onOrientation);
      })
      .catch(() => {
        // permission denied or unsupported: no compass fallback available
      });
  } else {
    window.addEventListener('deviceorientation', onOrientation);
  }

  return () => {
    cancelled = true;
    window.removeEventListener('deviceorientation', onOrientation);
  };
}

const USER_DOT_COLOR = '#2A7FFF';
const USER_ARROW_IMAGE_ID = 'user-arrow';
const ARROW_SIZE = 24;

function buildArrowImage(): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = ARROW_SIZE;
  canvas.height = ARROW_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new ImageData(ARROW_SIZE, ARROW_SIZE);
  ctx.fillStyle = USER_DOT_COLOR;
  ctx.beginPath();
  ctx.moveTo(ARROW_SIZE / 2, 0);
  ctx.lineTo(ARROW_SIZE * 0.85, ARROW_SIZE);
  ctx.lineTo(ARROW_SIZE / 2, ARROW_SIZE * 0.75);
  ctx.lineTo(ARROW_SIZE * 0.15, ARROW_SIZE);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, ARROW_SIZE, ARROW_SIZE);
}

function emptyUserFeatureCollection(): FeatureCollection<Point, { bearing: number }> {
  return { type: 'FeatureCollection', features: [] };
}

function emptyAccuracyFeatureCollection(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

// Adds the user location layers: a filled accuracy circle, a blue dot, and a rotating heading
// arrow. Re-addable after every 'style.load', same pattern as gage-layer.
export function addUserLayers(map: maplibregl.Map): void {
  if (!map.hasImage(USER_ARROW_IMAGE_ID)) {
    map.addImage(USER_ARROW_IMAGE_ID, buildArrowImage());
  }

  if (!map.getSource('user-accuracy')) {
    map.addSource('user-accuracy', { type: 'geojson', data: emptyAccuracyFeatureCollection() });
  }
  if (!map.getSource('user')) {
    map.addSource('user', { type: 'geojson', data: emptyUserFeatureCollection() });
  }

  if (!map.getLayer('user-accuracy')) {
    map.addLayer({
      id: 'user-accuracy',
      type: 'fill',
      source: 'user-accuracy',
      paint: { 'fill-color': USER_DOT_COLOR, 'fill-opacity': 0.15 },
    });
  }

  if (!map.getLayer('user-dot')) {
    map.addLayer({
      id: 'user-dot',
      type: 'circle',
      source: 'user',
      paint: {
        'circle-radius': 8,
        'circle-color': USER_DOT_COLOR,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
  }

  if (!map.getLayer('user-heading')) {
    map.addLayer({
      id: 'user-heading',
      type: 'symbol',
      source: 'user',
      layout: {
        'icon-image': USER_ARROW_IMAGE_ID,
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-size': 1,
      },
    });
  }
}

// Pushes a new fix (and its follow-mode bearing, if any) into the user layers' sources.
export function updateUser(map: maplibregl.Map, f: Fix, bearing: number | null): void {
  const accuracySource = map.getSource<maplibregl.GeoJSONSource>('user-accuracy');
  if (accuracySource) {
    void accuracySource.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [circlePolygon(f.lon, f.lat, f.accuracy)] },
        },
      ],
    });
  }

  const userSource = map.getSource<maplibregl.GeoJSONSource>('user');
  if (userSource) {
    void userSource.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { bearing: bearing ?? 0 },
          geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
        },
      ],
    });
  }
}
