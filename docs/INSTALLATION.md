# Installation and first-run guide

ARC Guard is for **rooted LG webOS TVs**. It is not a normal, unprivileged LG Content Store app. The boot service relies on Homebrew Channel (HBC) root support and its startup-hook directory.

## Option A — download the package from GitHub Actions

Once this repository is on GitHub:

1. Open **Actions** and choose a successful **Build IPK** run.
2. Download the workflow artifact named `arcguard-ipk`.
3. Extract it and find `ARCGuard_1.0.9.ipk`.

The artifact is built from the repository source using the official webOS CLI. This is a build artifact, not a guarantee of compatibility; the current version is still experimental.

## Option B — build it yourself

Requirements: Node.js 20+, npm or pnpm, Python 3, and internet access to the npm registry. The build uses a disposable directory for the pinned CLI installation and package output.

```sh
./scripts/check.sh
./scripts/build.sh
```

The package will be written to `dist/ARCGuard_1.0.9.ipk`.

## Install with SSH (macOS / Linux)

Find the TV's IP address in its network settings. Replace `root@192.168.1.123` below with your own SSH destination; do not use the example address literally.

```sh
./scripts/install-over-ssh.sh dist/ARCGuard_1.0.9.ipk root@192.168.1.123
```

The script copies the IPK to `/tmp/ARCGuard-install.ipk` and asks webOS's `com.webos.appInstallService` to install it. Watch the final installer status. If it reports `ipk verified failed`, stop and collect the package-installer logs instead of repeatedly retrying the same build.

Alternatively, copy the IPK yourself:

```sh
scp dist/ARCGuard_1.0.9.ipk root@192.168.1.123:/tmp/
ssh root@192.168.1.123
```

Then run on the TV:

```sh
luna-send-pub -i 'luna://com.webos.appInstallService/dev/install' '{"id":"com.ares.defaultName","ipkUrl":"/tmp/ARCGuard_1.0.9.ipk","subscribe":true}'
```

Wait until the final status says installation succeeded. The first JSON response only indicates that the request was accepted; it is not proof that installation completed.

## First launch — safe configuration

1. Open **ARC Guard** from the TV launcher.
2. Open **Settings** and leave **Enforce preferred output** turned off.
3. Set **Preferred output** to **HDMI ARC / eARC** and save settings.
4. In the TV's own Sound Out menu, choose ARC manually if it is not already selected.
5. Check that the soundbar plays normally.
6. In ARC Guard's **Status** screen, refresh and compare **Current output** with **Preferred output**.
7. Do not request a switch if the app already reports `HDMI ARC / eARC` as active. The app is intended to skip a redundant request, but firmware reporting still needs confirmation on the exact model.
8. Only after the manual apply path has been confirmed on the target firmware, open **Service & Help** and select **Install / repair boot service**.
9. Keep enforcement disabled for initial boot testing. Enable it only after observing safe behaviour.

After the boot service has been installed, opening ARC Guard checks whether its watcher is still running and starts it again if needed. If the Homebrew root service is temporarily unavailable, ARC Guard retries the check while the app remains open. The app also supports the standard directional and OK remote keys; focus begins on the Status tab.

If sound disappears, the TV reports an unknown output, or the soundbar repeatedly disconnects/reconnects, use the TV's normal Sound Out menu to restore ARC and turn off enforcement in ARC Guard. If the app is unavailable, the SSH recovery steps below can disable the watcher.

## Emergency: stop enforcement over SSH

Connect over SSH as root and run the following to change the saved setting to disabled. This modifies ARC Guard's configuration only:

```sh
mkdir -p /var/lib/webosbrew/arcguard
if [ -f /var/lib/webosbrew/arcguard/config.env ]; then
  sed 's/^enabled=.*/enabled=0/' /var/lib/webosbrew/arcguard/config.env > /tmp/arcguard-config.env
  if ! grep -q '^enabled=' /tmp/arcguard-config.env; then echo 'enabled=0' >> /tmp/arcguard-config.env; fi
  cat /tmp/arcguard-config.env > /var/lib/webosbrew/arcguard/config.env
  rm -f /tmp/arcguard-config.env
else
  printf 'enabled=0\ntarget=external_arc\ninterval=3\nstartup_delay=20\npause_until=0\n' > /var/lib/webosbrew/arcguard/config.env
fi
```

The watcher reads the setting on its next polling cycle. If necessary, stop its recorded process:

```sh
if [ -f /var/lib/webosbrew/arcguard/watcher.pid ]; then
  pid="$(cat /var/lib/webosbrew/arcguard/watcher.pid)"
  case "$pid" in
    *[!0-9]*|'') ;;
    *)
      if kill -0 "$pid" 2>/dev/null && tr '\000' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -Fq '/media/developer/apps/usr/palm/applications/org.webosbrew.arcguard/bin/arcguard-watch.sh'; then
        kill "$pid" 2>/dev/null || true
      fi
      ;;
  esac
  rm -f /var/lib/webosbrew/arcguard/watcher.pid
fi
```

## Remove automatic startup

In the app, choose **Service & Help → Remove boot service**. If the app cannot launch, the boot hook can be removed directly:

```sh
rm -f /var/lib/webosbrew/init.d/50-orgwebosbrew-arcguard
if [ -f /var/lib/webosbrew/arcguard/watcher.pid ]; then
  pid="$(cat /var/lib/webosbrew/arcguard/watcher.pid)"
  case "$pid" in
    *[!0-9]*|'') ;;
    *)
      if kill -0 "$pid" 2>/dev/null && tr '\000' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -Fq '/media/developer/apps/usr/palm/applications/org.webosbrew.arcguard/bin/arcguard-watch.sh'; then
        kill "$pid" 2>/dev/null || true
      fi
      ;;
  esac
  rm -f /var/lib/webosbrew/arcguard/watcher.pid
fi
```

This removes auto-start only. It does not uninstall ARC Guard or delete saved settings/logs.

## Security note

Rooted-TV access is powerful. Do not run install commands that overwrite kernel, rootfs, or tvservice. ARC Guard does not need to write those partitions. Do not post your SSH password, private key, account information, or unredacted secrets in issue reports.
