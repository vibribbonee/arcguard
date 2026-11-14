#!/bin/sh
# Symlinked into /var/lib/webosbrew/init.d; return immediately so boot isn't blocked.
APPDIR=/media/developer/apps/usr/palm/applications/org.webosbrew.arcguard
DATA_DIR=/var/lib/webosbrew/arcguard
mkdir -p "$DATA_DIR"
[ -f "$DATA_DIR/config.env" ] || printf 'enabled=0\ntarget=external_arc\ninterval=3\nstartup_delay=20\npause_until=0\n' > "$DATA_DIR/config.env"
WATCH="$APPDIR/bin/arcguard-watch.sh"
[ -x "$WATCH" ] || exit 0
if [ -f "$DATA_DIR/watcher.pid" ]; then
  oldpid=$(cat "$DATA_DIR/watcher.pid" 2>/dev/null)
  case "$oldpid" in *[!0-9]*|'') oldpid='' ;; esac
  if [ -n "$oldpid" ] && kill -0 "$oldpid" 2>/dev/null && tr '\000' ' ' < "/proc/$oldpid/cmdline" 2>/dev/null | grep -Fq "$WATCH"; then exit 0; fi
fi
nohup "$WATCH" >> "$DATA_DIR/watcher.log" 2>&1 </dev/null &
echo $! > "$DATA_DIR/watcher.pid"
exit 0
