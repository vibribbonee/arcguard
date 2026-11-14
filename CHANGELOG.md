# Changelog

## 1.0.9 — startup recovery and remote navigation

- Check the installed Homebrew Channel hook when the app opens and restart the watcher if its recorded process is no longer running; retry if the root service is temporarily unavailable.
- Report watcher process state from the PID and process command line instead of trusting the last status file written before a crash.
- Start remote control on a focused Status tab and move focus through visible controls with the arrow keys.
- Validate watcher PID ownership before stopping a process, and avoid repeating background refresh error toasts.
- Keep local builds in a temporary directory, validate the IPK before replacing the same-version artifact, and preserve other package versions.
- Bump the package version and update build/install documentation.

**Validation status:** source changes have not yet been installed or exercised on a target TV. See README.

## 1.0.8 — repository source snapshot

- Split the TV UI into Status, Settings, and Service & Help tabs.
- Add settings for preferred output, enforcement, poll frequency, startup delay, and temporary pause.
- Query the webOS TV Sound Out API-adapter and avoid a redundant manual apply request when the reported output already matches the target.
- Add guarded retry behaviour intended to avoid repeatedly requesting the same output change when read-back does not change.
- Include Homebrew Channel startup hook, status diagnostics, log rotation, and SSH installation helper.
- Move toward official `@webos-tools/cli` packaging rather than hand-assembling IPK files.

**Validation status:** this is a development snapshot. The latest app source has not yet been confirmed as installed and working end-to-end on the original target TV. See README.
