#!/usr/bin/env bash
set -euo pipefail
# Self-host the glyphs + sprites the Protomaps basemap style references,
# so the app makes no third-party requests at runtime.
DEST="${DEST:-public/basemap-assets}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git clone -q --depth 1 --filter=blob:none --sparse https://github.com/protomaps/basemaps-assets "$TMP/assets"
git -C "$TMP/assets" sparse-checkout set "fonts/Noto Sans Regular" "fonts/Noto Sans Medium" "fonts/Noto Sans Italic" "sprites/v4"
mkdir -p "$DEST/fonts" "$DEST/sprites/v4"
cp -R "$TMP/assets/fonts/Noto Sans Regular" "$TMP/assets/fonts/Noto Sans Medium" "$TMP/assets/fonts/Noto Sans Italic" "$DEST/fonts/"
cp "$TMP/assets/sprites/v4/light".* "$TMP/assets/sprites/v4/dark".* "$DEST/sprites/v4/"
du -sh "$DEST"
