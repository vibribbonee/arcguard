#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/app"
OUT_DIR="$ROOT/dist"
CLI_VERSION="${WEBOS_CLI_VERSION:-3.2.6}"

if ! command -v node >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
  echo 'ERROR: install Node.js 20+ and Python 3 before building.' >&2
  exit 1
fi
if ! command -v npx >/dev/null 2>&1 && ! command -v pnpm >/dev/null 2>&1; then
  echo 'ERROR: install npm (for npx) or pnpm before building.' >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR < 20 )); then
  echo "ERROR: @webos-tools/cli needs Node.js 20+; found $(node --version)." >&2
  exit 1
fi

bash "$ROOT/scripts/check.sh"
mkdir -p "$OUT_DIR"
BUILD_DIR="$(mktemp -d "$OUT_DIR/.build.XXXXXX")"
trap 'rm -rf "$BUILD_DIR"' EXIT

# Use the official webOS CLI rather than constructing the Debian/IPK archive manually.
# Pin the CLI version so local and CI builds use the same packager.
if command -v npx >/dev/null 2>&1; then
  npx --yes --package="@webos-tools/cli@${CLI_VERSION}" ares-package -n -o "$BUILD_DIR" "$APP_DIR"
else
  TOOL_DIR="$BUILD_DIR/.cli"
  mkdir -p "$TOOL_DIR"
  printf '{"name":"arcguard-build-tools","version":"1.0.0","private":true}\n' > "$TOOL_DIR/package.json"
  # Package creation does not need the CLI's optional native SSH acceleration.
  pnpm --dir "$TOOL_DIR" add --save-exact --ignore-scripts "@webos-tools/cli@${CLI_VERSION}"
  "$TOOL_DIR/node_modules/.bin/ares-package" -n -o "$BUILD_DIR" "$APP_DIR"
fi

APP_VERSION="$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).version' "$APP_DIR/appinfo.json")"
shopt -s nullglob
PACKAGES=("$BUILD_DIR"/*.ipk)
if (( ${#PACKAGES[@]} != 1 )); then
  echo "ERROR: expected exactly one IPK from ares-package; found ${#PACKAGES[@]}." >&2
  ls -la "$BUILD_DIR" >&2 || true
  exit 1
fi
FINAL="$OUT_DIR/ARCGuard_${APP_VERSION}.ipk"
PACKAGE="${PACKAGES[0]}"
python3 "$ROOT/scripts/validate_ipk.py" "$PACKAGE"
mv -f "$PACKAGE" "$FINAL"

python3 -c 'import hashlib, sys; path = sys.argv[1]; digest = hashlib.sha256(open(path, "rb").read()).hexdigest(); print("%s  %s" % (digest, path))' "$FINAL"
printf '\nBuilt package: %s\n' "$FINAL"
printf 'This package still requires installation and audio validation on the target TV.\n'
