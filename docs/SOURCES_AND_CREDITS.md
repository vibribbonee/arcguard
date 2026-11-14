# Sources and credits

ARC Guard is an independent homebrew project. The references below document the packaging tool, rooted-TV integration points, app metadata, and commonly used webOS TV audio-output endpoints. The listed projects are not dependencies bundled into ARC Guard, and their authors do not endorse this project.

## Build and packaging

- **webOS CLI** — [`webos-tools/cli`](https://github.com/webos-tools/cli), npm package [`@webos-tools/cli`](https://www.npmjs.com/package/@webos-tools/cli). ARC Guard pins this package in its build script and uses `ares-package`. The CLI's own license is Apache-2.0; no CLI source is copied into this repository.
- **webOS app metadata reference** — [webOS OSE `appinfo.json` documentation](https://www.webosose.org/docs/guides/development/configuration-files/appinfo-json/). This documents the general application metadata structure; retail webOS TV firmware may differ from OSE in some behaviours.

## Rooted-TV integration

- **Homebrew Channel** — [`webosbrew/webos-homebrew-channel`](https://github.com/webosbrew/webos-homebrew-channel). ARC Guard uses its documented root execution service (`luna://org.webosbrew.hbchannel.service/exec`) when running on a rooted TV with HBC installed.
- **Homebrew startup hooks** — [webOS Homebrew documentation for `/var/lib/webosbrew/init.d`](https://github.com/webosbrew/pages/blob/main/content/pages/hacking/overlays.md). ARC Guard follows the startup-hook approach by symlinking its own executable script into that directory. It does not include or modify HBC source code.
- **Rooting safety background** — [webOS Homebrew: With Root](https://www.webosbrew.org/develop/guides/with-root/). Root-startup scripts are powerful and can make a device difficult to recover if they block or repeatedly fail at boot.

## Audio output API references

- [`hobbyquaker/lgtv2`](https://github.com/hobbyquaker/lgtv2) documents the webOS TV API-adapter endpoints `getSoundOutput` and `changeSoundOutput`, and output identifiers including `external_arc`, `tv_speaker`, `external_optical`, `bt_soundbar`, `headphone`, and `lineout`.
- [`home-assistant-libs/aiowebostv`](https://github.com/home-assistant-libs/aiowebostv/blob/main/aiowebostv/endpoints.py) lists `com.webos.service.apiadapter/audio/getSoundOutput` and `.../changeSoundOutput` as webOS TV endpoints.
- These are community-maintained references to internal APIs. They are not a promise of support on all TV models or firmware versions. ARC Guard uses no bundled code from these repositories.

## Project authorship

The ARC Guard application UI, watcher, boot hook, documentation and packaging scripts in this repository are specific to this project. No third-party JavaScript or shell source is intentionally vendored. `icon.png` is part of this project and is distributed with it under the repository license.

## Trademarks

LG, webOS, and related names and marks belong to their respective owners. ARC Guard is not affiliated with, sponsored by, or endorsed by LG Electronics.
