#!/usr/bin/env bash
set -euo pipefail
# Self-host the glyphs + sprites the Protomaps basemap style references,
# so the app makes no third-party requests at runtime.
DEST="${DEST:-public/basemap-assets}"
# Pinned to a known-good commit rather than floating `main`, so a bad upstream push can't
# silently change what we ship. Bump by re-resolving:
#   gh api repos/protomaps/basemaps-assets/commits/main --jq .sha
ASSETS_REF="${ASSETS_REF:-028c18f713baecad011301ff7a69acc39bcc2ae7}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git -C "$TMP" init -q assets
git -C "$TMP/assets" remote add origin https://github.com/protomaps/basemaps-assets
git -C "$TMP/assets" config core.sparseCheckout true
git -C "$TMP/assets" sparse-checkout set "fonts/Noto Sans Regular" "fonts/Noto Sans Medium" "fonts/Noto Sans Italic" "sprites/v4"
git -C "$TMP/assets" fetch --depth 1 origin "$ASSETS_REF"
git -C "$TMP/assets" checkout FETCH_HEAD
mkdir -p "$DEST/fonts" "$DEST/sprites/v4"
cp -R "$TMP/assets/fonts/Noto Sans Regular" "$TMP/assets/fonts/Noto Sans Medium" "$TMP/assets/fonts/Noto Sans Italic" "$DEST/fonts/"
# Both 1x and @2x variants: MapLibre requests <name>@2x.{json,png} on high-DPI screens.
cp "$TMP/assets/sprites/v4/light"*.* "$TMP/assets/sprites/v4/dark"*.* "$DEST/sprites/v4/"
du -sh "$DEST"
