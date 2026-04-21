#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DIST_DIR="$ROOT_DIR/dist"
PACKAGE_DIR="$DIST_DIR/package"
MANIFEST_PATH="$ROOT_DIR/manifest.json"
VERSION=$(node -p "require(process.argv[1]).version" "$MANIFEST_PATH")
ARCHIVE_PATH="$DIST_DIR/jira-board-browse-tab-$VERSION.zip"

rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

cp "$ROOT_DIR/manifest.json" "$PACKAGE_DIR/"
cp -R "$ROOT_DIR/src" "$PACKAGE_DIR/src"
cp -R "$ROOT_DIR/icons" "$PACKAGE_DIR/icons"

(
  cd "$PACKAGE_DIR"
  zip -qr "$ARCHIVE_PATH" .
)

printf '%s\n' "$ARCHIVE_PATH"
