#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SOURCE_DIR="$ROOT_DIR/webstore/source"
OUTPUT_DIR="$ROOT_DIR/webstore/assets"
CHROME_BIN=${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}

mkdir -p "$OUTPUT_DIR"

render() {
  name=$1
  width=$2
  height=$3

  "$CHROME_BIN" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --allow-file-access-from-files \
    --screenshot="$OUTPUT_DIR/$name.png" \
    --window-size="$width,$height" \
    "file://$SOURCE_DIR/$name.html"
}

render screenshot-01-open-browse 1280 800
render screenshot-02-enable-site 1280 800
render screenshot-03-manage-sites 1280 800
render promo-small 440 280
render promo-marquee 1400 560
