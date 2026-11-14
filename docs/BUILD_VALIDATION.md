# Build validation record

## Version 1.0.9

The startup-recovery, high-contrast focus, and remote-friendly picker/navigation changes have not been installed on a target TV.

- On 2026-10-22, `scripts/build.sh` completed with `@webos-tools/cli` 3.2.6. Source checks and IPK structural checks passed.
- Artifact: `dist/ARCGuard_1.0.9.ipk` (17,418 bytes)
- SHA-256: `29e1555929db3c9ffe27836b83d87a23a8b97ccdbb566a737c4f16e3b3298e24`
- The CLI warns that `requiredACG` is absent. The app targets webOS TV 6.3.2 and calls the private Homebrew Channel root service; the right ACG declaration for that service has not been confirmed. LG documents ACG as unsupported through webOS TV 25, supported on 26, and required on 27 and later. Revisit this before claiming support for newer webOS versions: [LG ACG guide](https://webostv.developer.lge.com/develop/guides/acg-guide).
- Package installation and audio behaviour on the target TV remain unverified.

## Version 1.0.8 baseline

The following checks were completed while preparing the 1.0.8 source snapshot:

- Parsed `app/appinfo.json` as JSON.
- Ran `node --check` on `app/app.js`.
- Ran `sh -n` on the boot hook, watcher, build script and SSH install helper.
- Syntax-checked the IPK validator with Python 3.
- Checked that the app footer version matches `appinfo.json` and that the expected UI panels exist.

The official webOS CLI package download did not complete in the preparation environment, so an official-CLI IPK was **not** generated or claimed as validated here. The GitHub Actions workflow is set up to perform the actual `ares-package` build on GitHub's runner. A successful CI package still needs installation and audio behaviour tests on target hardware.
