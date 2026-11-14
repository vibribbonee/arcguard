#!/bin/sh
# ARC Guard background watcher. Started by a Homebrew Channel init.d hook as root.
# Uses the TV's audio policy service, not the lower-level audiooutput HAL API.
DATA_DIR=/var/lib/webosbrew/arcguard
CONFIG="$DATA_DIR/config.env"
STATUS="$DATA_DIR/status.json"
LOG="$DATA_DIR/watcher.log"
REQUEST_GUARD="$DATA_DIR/request-guard.env"
LUNA_SEND=/usr/bin/luna-send
[ -x "$LUNA_SEND" ] || LUNA_SEND="$(command -v luna-send 2>/dev/null)"
[ -n "$LUNA_SEND" ] || { echo "luna-send not found" >> "$LOG"; exit 1; }
mkdir -p "$DATA_DIR"

cfg() { sed -n "s/^$1=//p" "$CONFIG" 2>/dev/null | tail -n 1; }
gcfg() { sed -n "s/^$1=//p" "$REQUEST_GUARD" 2>/dev/null | tail -n 1; }
valid_target() {
  case "$1" in
    external_arc|tv_speaker|external_optical|bt_soundbar|lineout|headphone) return 0 ;;
    *) return 1 ;;
  esac
}
valid_current() {
  case "$1" in
    external_arc|tv_speaker|external_optical|external_speaker|tv_external_speaker|lgSoundSync|bt_soundbar|wisa_speaker|lineout|headphone|tv_speaker_headphone|alsa|null) return 0 ;;
    *) return 1 ;;
  esac
}
get_output() {
  # Read the retail TV Sound Out value from the same API-adapter used to change it.
  "$LUNA_SEND" -n 1 -f luna://com.webos.service.apiadapter/audio/getSoundOutput '{}' 2>/dev/null |
    sed -n \
      -e 's/.*"output"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      -e 's/.*"soundOutput"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
}
set_output() {
  # The retail TV Sound Out selector is exposed by the API adapter. Do not call
  # com.webos.service.audio/setSoundOutput here: on OSE/low-level audio APIs that
  # endpoint refers to PCM/ALSA sinks rather than TV Sound Out modes such as external_arc.
  "$LUNA_SEND" -n 1 -f luna://com.webos.service.apiadapter/audio/changeSoundOutput "{\"output\":\"$1\"}" 2>&1
}
log_event() {
  if [ -f "$LOG" ]; then
    log_size=$(wc -c < "$LOG" 2>/dev/null | tr -d ' '); [ -n "$log_size" ] || log_size=0
    if [ "$log_size" -gt 32768 ] 2>/dev/null; then mv -f "$LOG" "$LOG.1" 2>/dev/null || :; fi
  fi
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S' 2>/dev/null)" "$*" >> "$LOG"
}
write_status() {
  # Values are constrained to known enums or fixed strings before writing JSON.
  tmp="$STATUS.tmp.$$"
  printf '{"running":true,"enabled":%s,"current":"%s","target":"%s","lastAction":"%s","lastError":"%s","lastCheck":%s,"corrections":%s,"pausedUntil":%s}\n' \
    "$s_enabled" "$s_current" "$s_target" "$s_action" "$s_error" "$s_check" "$s_corrections" "$s_pause" > "$tmp"
  mv "$tmp" "$STATUS"
}

boot_epoch=$(date +%s 2>/dev/null); [ -n "$boot_epoch" ] || boot_epoch=0
s_action='Watcher started'
s_error=''
s_current='unknown'
s_target='external_arc'
s_enabled=true
s_check=0
s_corrections=0
s_pause=0
mismatch_count=0
last_attempt=0
last_attempt_current=''
last_attempt_target=''
attempts_for_state=0
retry_suppressed=0
last_request_accepted=0

while :; do
  enabled=$(cfg enabled); case "$enabled" in 0|1) ;; *) enabled=1 ;; esac
  target=$(cfg target); valid_target "$target" || target=external_arc
  interval=$(cfg interval); case "$interval" in 2|3|5|10) ;; *) interval=3 ;; esac
  delay=$(cfg startup_delay); case "$delay" in 0|10|20|45|90) ;; *) delay=20 ;; esac
  pause=$(cfg pause_until); case "$pause" in ''|*[!0-9]*) pause=0 ;; esac
  s_enabled=true; [ "$enabled" = 1 ] || s_enabled=false
  s_target=$target; s_pause=$pause
  now=$(date +%s 2>/dev/null); [ -n "$now" ] || now=0
  raw=$(get_output)
  if valid_current "$raw"; then s_current=$raw; else s_current=unknown; fi
  s_check=$now

  # A manual Apply writes this guard before sending its one change request.
  # Keep it only while both the requested target and the last observed current
  # output are unchanged. A real observed transition re-arms enforcement.
  if [ -f "$REQUEST_GUARD" ]; then
    guard_current=$(gcfg current)
    guard_target=$(gcfg target)
    if [ "$s_current" = "$target" ] || [ "$target" != "$guard_target" ] || [ "$s_current" != "$guard_current" ]; then
      rm -f "$REQUEST_GUARD"
    fi
  fi

  if [ "$enabled" != 1 ]; then
    s_action='Enforcement disabled'; s_error=''; mismatch_count=0
    rm -f "$REQUEST_GUARD"
    last_attempt_current=''; last_attempt_target=''; attempts_for_state=0; retry_suppressed=0; last_request_accepted=0
  elif [ "$pause" -gt "$now" ] 2>/dev/null; then
    s_action='Enforcement paused'; s_error=''; mismatch_count=0
    last_attempt_current=''; last_attempt_target=''; attempts_for_state=0; retry_suppressed=0; last_request_accepted=0
  elif [ "$s_current" = unknown ]; then
    s_action='Unable to read output'; s_error='The TV audio service did not return a recognised soundOutput value.'; mismatch_count=0
  elif [ "$s_current" = "$target" ]; then
    s_action='Output matches target'; s_error=''; mismatch_count=0
    # Output is confirmed at target. A later real change away from it may be corrected.
    last_attempt_current=''; last_attempt_target=''; attempts_for_state=0; retry_suppressed=0; last_request_accepted=0
  elif [ -f "$REQUEST_GUARD" ] && [ "$(gcfg current)" = "$s_current" ] && [ "$(gcfg target)" = "$target" ]; then
    s_action='Manual request already sent; waiting for output read-back'
    s_error='A manual output request is already in flight for this unchanged output. Duplicate requests are suppressed to avoid repeated ARC renegotiation.'
    mismatch_count=0
  elif [ $((now - boot_epoch)) -lt "$delay" ] 2>/dev/null; then
    s_action='Waiting for startup settle'; s_error=''; mismatch_count=0
  else
    # Gate requests by the unchanged (reported output, target) pair. If webOS
    # accepts a request but read-back never changes, repeating it can repeatedly
    # renegotiate ARC and disrupt a soundbar.
    if [ "$s_current" != "$last_attempt_current" ] || [ "$target" != "$last_attempt_target" ]; then
      last_attempt_current=$s_current
      last_attempt_target=$target
      attempts_for_state=0
      retry_suppressed=0
      last_request_accepted=0
      mismatch_count=0
    fi
    if [ "$retry_suppressed" = 1 ]; then
      if [ "$last_request_accepted" = 1 ]; then
        s_action='Request accepted; waiting for output read-back'
        s_error='The TV accepted a change request but still reports the same output. Further automatic requests are suppressed to avoid repeated audio/ARC renegotiation.'
      else
        s_action='Automatic retries stopped'
        s_error='The TV did not confirm the output change after two attempts. Further automatic requests are suppressed to avoid repeated audio/ARC renegotiation.'
      fi
      mismatch_count=0
    else
      mismatch_count=$((mismatch_count + 1))
      retry_delay=12
      [ "$attempts_for_state" -eq 0 ] || retry_delay=60
      if [ "$mismatch_count" -ge 2 ] && [ $((now - last_attempt)) -ge "$retry_delay" ]; then
        response=$(set_output "$target")
        last_attempt=$now
        attempts_for_state=$((attempts_for_state + 1))
        case "$response" in
          *'"returnValue":true'*|*'"returnValue": true'*)
            s_action='Requested target output; waiting for read-back'
            s_error=''; s_corrections=$((s_corrections + 1)); mismatch_count=0
            last_request_accepted=1
            retry_suppressed=1
            log_event "requested $target from reported output $s_current; suppressing duplicate requests until state changes"
            ;;
          *)
            s_action='Correction request failed'
            s_error='The audio service rejected or did not confirm the request.'
            log_event "failed requesting $target from $s_current: $response"
            if [ "$attempts_for_state" -ge 2 ]; then retry_suppressed=1; fi
            ;;
        esac
      else
        s_action='Output differs from target'; s_error='';
      fi
    fi
  fi
  write_status
  sleep "$interval"
done
