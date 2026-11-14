#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/app"

command -v node >/dev/null 2>&1 || { echo 'ERROR: Node.js is required for metadata and JavaScript checks.' >&2; exit 1; }

node --check "$APP/app.js"
sh -n "$APP/boot.sh"
sh -n "$APP/bin/arcguard-watch.sh"

node - "$APP/appinfo.json" "$APP/index.html" "$APP/boot.sh" "$APP/bin/arcguard-watch.sh" <<'NODE'
const fs = require('fs');
const [metadataPath, htmlPath, bootPath, watcherPath] = process.argv.slice(2);
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const html = fs.readFileSync(htmlPath, 'utf8');
if (!metadata.id || !metadata.version || metadata.type !== 'web' || metadata.main !== 'index.html') {
  throw new Error('app/appinfo.json is missing required metadata or has unexpected type/main values.');
}
if (!html.includes(`ARC Guard ${metadata.version}`)) {
  throw new Error(`The footer version in index.html must match appinfo.json version ${metadata.version}.`);
}
for (const path of [bootPath, watcherPath]) {
  fs.accessSync(path, fs.constants.R_OK | fs.constants.X_OK);
}
for (const id of ['pageStatus', 'pageSettings', 'pageService']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing UI panel ${id}`);
}
console.log(`Source checks passed for ARC Guard ${metadata.version} (${metadata.id}).`);
NODE
