#!/usr/bin/env bash
set -euo pipefail
if (( $# != 2 )); then
  echo "Usage: $0 PATH_TO_IPK root@TV_IP" >&2
  echo "Example: $0 dist/ARCGuard_1.0.9.ipk root@192.168.1.123" >&2
  exit 2
fi
IPK="$1"
TV_HOST="$2"
if [[ ! -f "$IPK" ]]; then echo "ERROR: IPK not found: $IPK" >&2; exit 1; fi
REMOTE_FILE=/tmp/ARCGuard-install.ipk

echo "Copying package to $TV_HOST:$REMOTE_FILE"
scp "$IPK" "$TV_HOST:$REMOTE_FILE"
echo "Requesting install on the TV. Wait for the final statusValue/state response."
ssh "$TV_HOST" "luna-send-pub -i 'luna://com.webos.appInstallService/dev/install' '{\"id\":\"com.ares.defaultName\",\"ipkUrl\":\"$REMOTE_FILE\",\"subscribe\":true}'"
