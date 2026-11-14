# Contributing

Thanks for helping test ARC Guard. The project is experimental; reports from actual TVs are especially valuable.

## Before opening a pull request

- Run `./scripts/check.sh`.
- Keep the app version in `app/appinfo.json`, the UI footer in `app/index.html`, and release notes in sync.
- Do not commit generated `.ipk` files to source commits. Use the CI artifact or a tagged release after testing.
- Do not introduce code that writes to kernel, rootfs, or tvservice partitions.
- Keep enforcement disabled by default and preserve request-suppression protections against repeated ARC/eARC renegotiation.
- Update docs when changing install paths, audio API methods, config keys or startup-hook behaviour.

## Good bug reports

Include TV model, webOS software version, whether Homebrew Channel root status is healthy, app version, the current value shown by the TV's Sound Out menu, the value ARC Guard reports, the displayed error, and a short relevant excerpt from `/var/lib/webosbrew/arcguard/watcher.log`.

Redact TV public IPs, passwords, SSH private keys, account details, and unrelated device-identifying data. Never include credentials in a report or commit.

## Pull-request scope

Prefer small changes with a clear problem statement. UI changes should be navigable with a TV remote, use visible focus styling, and fit common 720p/1080p TV layouts. Audio changes should be tested with enforcement disabled first.
