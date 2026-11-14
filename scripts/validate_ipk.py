#!/usr/bin/env python3
"""Basic structural checks for a webOS IPK produced by ares-package."""
from __future__ import annotations
import gzip
import io
import json
import sys
import tarfile
from pathlib import Path

AR_MAGIC = b"!<arch>\n"


def fail(message: str) -> None:
    raise SystemExit(f"IPK validation failed: {message}")


def parse_ar(path: Path):
    data = path.read_bytes()
    if not data.startswith(AR_MAGIC):
        fail("file does not start with the ar archive signature")
    pos = len(AR_MAGIC)
    members = {}
    timestamps = {}
    while pos < len(data):
        if pos + 60 > len(data):
            fail("truncated ar member header")
        header = data[pos : pos + 60]
        if header[58:60] != b"`\n":
            fail("invalid ar member header terminator")
        raw_name = header[:16].decode("ascii", "replace").strip()
        name = raw_name.rstrip("/")
        try:
            timestamp = int(header[16:28].decode("ascii").strip() or "0")
            size = int(header[48:58].decode("ascii").strip())
        except ValueError:
            fail(f"invalid timestamp/size for ar member {name!r}")
        start = pos + 60
        end = start + size
        if end > len(data):
            fail(f"truncated data for ar member {name!r}")
        if name in members:
            fail(f"duplicate ar member name {name!r}")
        members[name] = data[start:end]
        timestamps[name] = timestamp
        pos = end + (size % 2)
    return members, timestamps


def normalized_names(tar: tarfile.TarFile):
    return {m.name.removeprefix("./"): m for m in tar.getmembers()}


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: validate_ipk.py PACKAGE.ipk")
    path = Path(sys.argv[1])
    members, timestamps = parse_ar(path)
    required = {"debian-binary", "control.tar.gz", "data.tar.gz"}
    missing = required - members.keys()
    if missing:
        fail("missing outer archive member(s): " + ", ".join(sorted(missing)))
    for name, timestamp in timestamps.items():
        if timestamp <= 0:
            fail(f"outer archive member {name!r} has a zero/epoch timestamp")
    if members["debian-binary"].strip() != b"2.0":
        fail("unexpected debian-binary format marker")

    try:
        with tarfile.open(fileobj=io.BytesIO(gzip.decompress(members["data.tar.gz"])), mode="r:") as data_tar:
            data = normalized_names(data_tar)
            appinfo_path = "usr/palm/applications/org.webosbrew.arcguard/appinfo.json"
            packageinfo_path = "usr/palm/packages/org.webosbrew.arcguard/packageinfo.json"
            for expected in (appinfo_path, packageinfo_path,
                             "usr/palm/applications/org.webosbrew.arcguard/app.js",
                             "usr/palm/applications/org.webosbrew.arcguard/boot.sh",
                             "usr/palm/applications/org.webosbrew.arcguard/bin/arcguard-watch.sh"):
                if expected not in data:
                    fail(f"data archive is missing {expected}")
            appinfo_file = data_tar.extractfile(data[appinfo_path])
            packageinfo_file = data_tar.extractfile(data[packageinfo_path])
            if appinfo_file is None or packageinfo_file is None:
                fail("could not read app or package metadata")
            appinfo = json.load(appinfo_file)
            packageinfo = json.load(packageinfo_file)
            if appinfo.get("id") != "org.webosbrew.arcguard":
                fail("unexpected app ID")
            if str(packageinfo.get("id")) != "org.webosbrew.arcguard":
                fail("unexpected package ID")
            for member in data_tar.getmembers():
                if member.isdir() and (member.mode & 0o2000):
                    fail(f"directory {member.name!r} has the set-group-ID bit set")
    except (OSError, tarfile.TarError, gzip.BadGzipFile, json.JSONDecodeError) as exc:
        fail(f"could not inspect data.tar.gz: {exc}")

    try:
        with tarfile.open(fileobj=io.BytesIO(gzip.decompress(members["control.tar.gz"])), mode="r:") as control_tar:
            control_names = {m.name.removeprefix("./") for m in control_tar.getmembers()}
            if "control" not in control_names:
                fail("control archive does not contain control metadata")
    except (OSError, tarfile.TarError, gzip.BadGzipFile) as exc:
        fail(f"could not inspect control.tar.gz: {exc}")

    print(f"IPK structural checks passed: {path} ({path.stat().st_size} bytes)")
    print("Note: local structural checks do not replace verification by webOS or testing on a real TV.")


if __name__ == "__main__":
    main()
