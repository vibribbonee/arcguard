# Architecture

## Components

- `app/index.html`, `app/style.css`, and `app/app.js` provide the three-tab UI.
- The UI uses the Homebrew Channel service `luna://org.webosbrew.hbchannel.service/exec` to run restricted command strings as root on an already-rooted TV.
- `app/boot.sh` is linked into `/var/lib/webosbrew/init.d/` when the user chooses to install/repair the boot service. The startup hook must return promptly, so it launches the watcher in the background.
- On app launch, the UI checks the installed hook and recorded watcher process. If the hook is still installed and the watcher is stopped, it invokes the hook to recover the process. If the Homebrew root service is temporarily unavailable, the UI retries while the app remains open.
- `app/bin/arcguard-watch.sh` reads configuration, queries the current Sound Out value, compares it with the selected target, and may send one change request after repeated mismatch checks.
- `/var/lib/webosbrew/arcguard/config.env` stores settings; `status.json` and `watcher.log` store diagnostics. Runtime data is outside the packaged app directory so it can survive app updates.

## Audio output flow

1. Query `luna://com.webos.service.apiadapter/audio/getSoundOutput`.
2. Extract the reported `output` or `soundOutput` field.
3. Compare it with the configured target. The ARC value used by many webOS TV API clients is `external_arc`.
4. If mismatch persists through multiple checks and the boot delay/pause rules permit it, request `luna://com.webos.service.apiadapter/audio/changeSoundOutput` with `{"output":"external_arc"}` (or the selected target).
5. If a request is accepted but the read-back state remains unchanged, suppress further requests for that unchanged state to reduce repeated ARC/eARC renegotiation.

These endpoints are community-documented internal webOS TV APIs rather than a stable cross-version public guarantee. The code is defensive about a missing/unknown response, but must be tested on each target model and firmware.

## Important invariants

- Enforcement defaults off on first install.
- Never issue a set request if the query reports that the target already matches.
- Request suppression is intended to prevent repeated switching while the reported state remains unchanged.
- A user can disable enforcement or remove the startup hook.
- The app starts with focus on the Status tab and moves focus between visible controls with the remote's directional keys.
- The project should not modify system partitions. The only persistent startup change is the app's symlink in `/var/lib/webosbrew/init.d/`.

## Design caveat

A successful Luna response only means the request was accepted; it does not guarantee that audio is audible or that the physical soundbar completed ARC/eARC negotiation. Status output and real audible behaviour must both be checked on the device.
