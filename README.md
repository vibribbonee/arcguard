# ARC Guard

**A rooted LG webOS TV helper that watches Sound Out and can request HDMI ARC/eARC again when the TV switches away from it.**

ARC Guard is a small webOS web app plus a background shell watcher for rooted LG TVs. It has a remote-friendly, three-tab interface for status, settings, and boot-service management. The goal is to stop the TV unexpectedly falling back to its internal speakers without repeatedly renegotiating ARC when the output is already correct.

> [!WARNING]
> **Experimental / not yet validated as a complete release on the target TV.** The initial package (1.0.5) installed and launched on an LG 43UP78006LB running webOS 6.3.2-425, but its Settings tab did not open correctly and its output-setting behaviour was not reliable. Manually assembled follow-up packages were rejected by that TV's installer. This repository therefore uses the official webOS CLI to build packages instead of distributing the earlier manually assembled IPKs. The source includes attempted fixes, but the current source must still be installed and tested on the target TV before enforcement is enabled. See [known limitations](#known-status-and-limitations).

## Features

- **Status screen:** current and preferred output, last action, correction count, and recent errors.
- **Settings screen:** enable/disable enforcement, select a preferred output, configure polling interval and startup delay, and pause enforcement temporarily.
- **Service & Help screen:** install/repair or remove the boot hook and view diagnostics.
- **Boot-time watcher:** uses the Homebrew Channel startup-hook directory so the app does not need to remain open.
- **Launch recovery:** when the installed boot hook is present, opening ARC Guard checks the watcher process and restarts it if it stopped. If Homebrew's root service is temporarily unavailable, the app retries while open.
- **Remote navigation:** starts with a clear high-contrast focus ring, supports arrow-key movement across visible controls, and lets you move through setting menus with Up/Down. Left/Right leaves a menu; Back/Escape closes it.
- **Conservative correction behaviour:** waits after boot, requires repeated mismatch observations, avoids requesting an output switch when the output is already reported as the target, and suppresses repeated requests when a request is accepted but read-back does not change.
- **Persistent settings:** stored under `/var/lib/webosbrew/arcguard/`, outside the application package.
- **No system-partition writes:** it does not write to kernel, rootfs, or tvservice partitions.

## Compatibility

| Item | Details |
|---|---|
| Intended platform | Rooted LG webOS TV |
| Hardware test platform | Rooted LG UP78 43-inch 4K Smart UHD TV (43UP78006LB) running webOS 6.3.2-425 |
| Root/homebrew dependency | Homebrew Channel with its root `exec` service and startup hooks |
| Packaging | `@webos-tools/cli` (`ares-package`) |
| Audio output API | `luna://com.webos.service.apiadapter/audio/getSoundOutput` and `.../changeSoundOutput` |

The list of output identifiers in this project comes from community-documented webOS TV APIs. Available options and returned values may vary by model and webOS version. The target TV may report an output differently from the values currently recognized by the watcher.

## Repository layout

```text
app/                         webOS application source
  appinfo.json               webOS app metadata
  index.html                 three-tab TV UI
  style.css                  remote-friendly layout and focus styling
  app.js                     UI, settings, status, Luna root-service bridge
  icon.png                   launcher icon
  boot.sh                    Homebrew Channel startup hook target
  bin/arcguard-watch.sh      background audio output watcher
scripts/check.sh             local static/syntax checks
scripts/build.sh             build an IPK using the official webOS CLI
scripts/install-over-ssh.sh  copy an IPK to a rooted TV and request install
.github/workflows/build.yml  CI build, downloadable artifact, tagged releases
docs/                        installation, architecture, sources, GitHub setup
```

## Getting a package without building locally

After this repository is pushed to GitHub, the **Build IPK** workflow runs on pushes and pull requests and uploads an IPK as a workflow artifact. To obtain it, open the repository's **Actions** tab, select the successful workflow run, and download its artifact.

A GitHub Release asset is generated only when a `v*` tag is pushed. **Do not create a public version tag until the generated package has been tested on a TV.** The version number in `app/appinfo.json` is the source version.

## Build locally (optional)

Requirements:

- Node.js 20 or newer
- npm or pnpm
- Python 3 (for the local IPK structure check)
- Network access to npm so `@webos-tools/cli` can be downloaded

From the repository root:

```sh
./scripts/check.sh
./scripts/build.sh
```

The script pins `@webos-tools/cli` to version `3.2.6`, packages `app/`, validates the resulting outer IPK archive and embedded app/package metadata, and writes the result to `dist/ARCGuard_1.0.9.ipk`. If npm is unavailable, it installs the CLI into a disposable build directory with pnpm. It does not hand-assemble an IPK, and it only replaces the matching versioned package after validation succeeds. The package output and SHA-256 checksum are printed at the end.

## Installation

See [Installation guide](docs/INSTALLATION.md). Static checks and build validation status are recorded in [Build validation](docs/BUILD_VALIDATION.md). Rooted webOS TV setup is a prerequisite. The application calls the Homebrew Channel root execution service, and the background watcher needs a startup hook to run after reboot.

**First-run safety:** after installing, open the app, leave **Enforce preferred output** disabled, select **HDMI ARC / eARC**, and test **Apply preferred output now** only if the TV reports a different current output. Confirm that sound works normally before enabling enforcement. If sound disappears or the soundbar repeatedly reconnects, disable enforcement and choose ARC in the TV's normal Sound Out menu.

## Known status and limitations

- The current source is **not yet confirmed working end-to-end on the target TV**. The app UI, audio API response format, root bridge, startup hook and watcher still need on-device testing together.
- The 1.0.5 package launched but exposed a Settings navigation issue and unreliable output-switch behaviour. Manual packages 1.0.6 and 1.0.7 were rejected by `com.webos.appInstallService` with `ipk verified failed`. Repository builds use the official CLI to avoid the hand-built packaging path; that alone is not proof that the resulting package will install on every firmware.
- The API may report `output` or `soundOutput`; the source checks both. If your firmware returns a different shape or identifier, the app will need a targeted compatibility change.
- If an output-change request is accepted but the active output does not change, the watcher intentionally suppresses repeated requests for that unchanged state. This protects against repeatedly interrupting ARC/eARC negotiation, but it may require a manual output change or a later state transition before automatic enforcement tries again.
- The app cannot guarantee that a soundbar will recover if the TV or HDMI-CEC/ARC connection itself has become unresponsive.

Please report firmware version, exact current output label, the app's displayed current output, action/error text, and a short redacted log excerpt when filing an issue. Do not post passwords, SSH keys, account information, or other secrets.

## Safety and security

- Root access is required, and root shell execution is powerful. Review the source before installing it.
- The watcher and startup hook only manage ARC Guard's own files, a symlink in `/var/lib/webosbrew/init.d`, and calls to the webOS audio API. They are not intended to modify system partitions.
- Keep enforcement disabled until a manual output change has been confirmed to work on your hardware.
- Prefer SSH public-key authentication over a default password when accessing your rooted TV.
- Removing the boot hook stops automatic startup; uninstalling the app is a separate step.

## Credits and references

See [Sources and credits](docs/SOURCES_AND_CREDITS.md) for the webOS CLI, Homebrew Channel integration documentation, app metadata documentation, and community API references. ARC Guard is an independent homebrew project; it is not affiliated with or endorsed by LG Electronics.

## License

Released under the [MIT License](LICENSE), except third-party tools and services cited in the documentation, which remain under their own licenses.

## Contributing

Pull requests are welcome. Describe what changed and how you tested it.

## AI disclosure

OpenAI Codex assisted with development, testing, and documentation.
