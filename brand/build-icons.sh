#!/usr/bin/env bash
# Regenerates every raster icon from the SVG sources.
#
#   app/icon.svg           master — the rounded tile, also served as-is to
#                          browsers that support SVG favicons
#   brand/icon-maskable.svg  full-bleed, mark inside the Android safe zone
#   brand/apple-icon.svg     full-bleed, iOS applies its own squircle mask
#
# Requires rsvg-convert (librsvg) and magick (ImageMagick 7).
# Run from the repo root: ./brand/build-icons.sh
set -euo pipefail
cd "$(dirname "$0")/.."

rsvg-convert -w 192 -h 192 app/icon.svg            -o public/icon-192.png
rsvg-convert -w 512 -h 512 app/icon.svg            -o public/icon-512.png
rsvg-convert -w 512 -h 512 brand/icon-maskable.svg -o public/icon-maskable-512.png
rsvg-convert -w 180 -h 180 brand/apple-icon.svg    -o app/apple-icon.png

# Multi-size .ico for browsers and OSes that still ask for one.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
for s in 16 32 48; do
  rsvg-convert -w "$s" -h "$s" app/icon.svg -o "$tmp/$s.png"
done
magick "$tmp/16.png" "$tmp/32.png" "$tmp/48.png" app/favicon.ico

echo "icons rebuilt"
