#!/usr/bin/env bash
set -euo pipefail
# Extract Jabodetabek from the latest Protomaps daily build.
# Requires: pmtiles CLI (brew install pmtiles / https://github.com/protomaps/go-pmtiles/releases)
# There is no builds index; daily files live at https://build.protomaps.com/YYYYMMDD.pmtiles,
# so probe backwards from today until one exists.
BBOX="${BBOX:-106.55,-6.45,107.05,-6.05}"
MAXZOOM="${MAXZOOM:-15}"
OUT="${OUT:-public/jakarta.pmtiles}"

find_build() {
  local i d url
  for i in $(seq 0 10); do
    d=$(date -u -v-"${i}"d +%Y%m%d 2>/dev/null || date -u -d "-${i} day" +%Y%m%d)
    url="https://build.protomaps.com/${d}.pmtiles"
    if curl -sfI "$url" >/dev/null; then
      echo "$url"
      return 0
    fi
  done
  echo "no protomaps build found in the last 10 days" >&2
  return 1
}

SRC=$(find_build)
echo "source build: $SRC"
mkdir -p "$(dirname "$OUT")"
pmtiles extract "$SRC" "$OUT" --bbox="$BBOX" --maxzoom="$MAXZOOM"
pmtiles show "$OUT"
ls -lh "$OUT"
