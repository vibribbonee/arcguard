# Security policy

ARC Guard is an experimental tool for **rooted** LG webOS TVs. It uses Homebrew Channel's root execution service and installs a boot hook at the user's request. A bug in a root-startup script can affect boot behaviour, so review the source and test cautiously.

## Reporting a vulnerability

Please do not publish credentials or exploitable details together with private device data in a public issue. Open a minimal issue asking for a private contact channel or contact the repository maintainer through the security feature available on the GitHub repository.

## Safety assumptions

- Rooted TV with a working, maintained Homebrew Channel installation.
- The watcher should never write to kernel, rootfs, or tvservice partitions.
- The watcher should default to enforcement disabled on first run.
- The user must be able to disable enforcement or remove the startup hook.
- SSH public-key authentication is preferred over a default password.
