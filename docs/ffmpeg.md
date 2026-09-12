# FFmpeg Toolchain

How the static FFmpeg/ffprobe binaries are fetched, verified, installed and
shipped.

## Overview

Media Converter does not include FFmpeg in source control. Binaries are
downloaded on demand and installed under `resources/ffmpeg/<platform-arch>/`.
They are then shipped in the application bundle via electron-builder
`extraResources`.

Two verification strategies exist in `prepare.mjs`:

- **Pinned** (macOS): the archive is verified against an immutable sha256
  recorded in `sources.json` at pinning time.
- **Rolling** (Windows, Linux): the artifact comes from BtbN's permanent
  `latest` tag (`ffmpeg-master-latest-win64-gpl.zip` etc.). BtbN only keeps a
  short window of dated daily autobuilds, so versioned URLs and their hashes
  expire together. Integrity is still enforced: `prepare.mjs` downloads the
  publisher's `checksums.sha256` sidecar from the same release and verifies the
  archive against it, and when run natively it additionally asserts the
  extracted binaries are a static GPL build (`-version`, `-buildconf`).

The full pipeline is driven by npm scripts:

| Script                | Purpose                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `pnpm ffmpeg:prepare` | Download + extract + verify (pinned sha256 or publisher checksum + build sanity). |
| `pnpm ffmpeg:verify`  | Confirm prepared binaries exist and run the expected build with all encoders |
| `pnpm ffmpeg:info`    | Print installed FFmpeg version and build configuration                       |

## Source registry — `scripts/ffmpeg/sources.json`

Every target platform-arch has an entry listing the URLs for the `ffmpeg` and
`ffprobe` binaries:

```json
{
  "darwin-arm64": {
    "platform": "darwin",
    "arch": "arm64",
    "files": [
      { "url": "…", "sha256": "…", "match": "ffmpeg" }
    ]
  },
  "win32-x64": {
    "platform": "win32",
    "arch": "x64",
    "files": [
      { "url": "…ffmpeg-master-latest-win64-gpl.zip", "rolling": true, "match": "ffmpeg.exe" }
    ]
  }
}
```

- Pinned entries carry an immutable `sha256`; `prepare.mjs` fails hard on
  mismatch.
- Rolling entries set `"rolling": true` and **must not** carry a `sha256` pin
  (the artifact moves with each build). Their archive is verified against the
  publisher-provided `checksums.sha256` of the same release, plus the native
  static-GPL assertion below.

The `match` field is the binary filename to extract from the archive. The
`prepare.mjs` script walks the extracted tree until it finds that exact name
and copies only that file to the target directory.

## Sources (current)

| Platform     | Provider           | Build                        | License          |
| ------------ | ------------------ | ---------------------------- | ---------------- |
| darwin-arm64 | osxexperts.net     | FFmpeg 9.0 (pinned, arm64)   | GPL-2.0-or-later |
| darwin-x64   | osxexperts.net     | FFmpeg 8.0 (pinned, Intel)   | GPL-2.0-or-later |
| win32-x64    | BtbN/FFmpeg-Builds | master `latest` (rolling)    | GPL-2.0-or-later |
| linux-x64    | BtbN/FFmpeg-Builds | master `latest` (rolling)    | GPL-2.0-or-later |

All builds are configured with `--enable-gpl` and include libx264, libx265,
libvpx (VP9), libmp3lame, libopus and other codecs. See `ffmpeg -buildconf`
on any installed binary for the full configure line.

> **Why GPL builds?** The format matrix requires software encoding to H.264
> (libx264) and H.266 (libx265) plus MP3 (libmp3lame), WEBM (VP9 + Opus)
> and OGG (Vorbis). These are all GPL-licensed encoder libraries; an LGPL
> build would lack them. The app remains MIT because FFmpeg is only ever
> invoked as an external subprocess and is never linked. See
> [licensing.md](licensing.md) for the full analysis.

## What `prepare.mjs` does

1. Determines the current platform-arch (`darwin-arm64`, `linux-x64`, etc.)
   or accepts `--target=<key>` to prepare for a specific platform.
2. For each binary entry in `sources.json`:
   - Checks if the destination already exists (skips unless `--force`).
   - Resolves the expected sha256:
     - pinned → the `sha256` from `sources.json`;
     - rolling → fetches `checksums.sha256` from the same GitHub release and
       looks up the archive's hash. Any failure (HTTP error, missing/malformed
       hash) aborts preparation - an archive is never installed without a
       verified checksum.
   - Reuses the cached archive only when its digest still equals the expected
     checksum; otherwise downloads to a temp directory.
   - Verifies the sha256. Fails hard on mismatch (removes the bad download).
   - Extracts the archive (zip on macOS/Windows, tar.xz on Linux).
   - Walks the extracted tree for the exact filename in `match`.
   - Copies the binary to `resources/ffmpeg/<target>/<filename>`.
   - On macOS, strips the quarantine attribute (`xattr -dr com.apple.quarantine`).
   - On Unix, sets the executable bit (`chmod +x`).
   - **Rolling entries only, when run natively on the target platform:** runs
     the extracted binary with `-version` (asserts it reports `ffmpeg version`
     / `ffprobe version`) and, for ffmpeg, `-buildconf` (asserts `--enable-gpl`
     and a static build). Cross-platform preparation (e.g. `--target=win32-x64`
     from macOS) keeps only the checksum verification.
3. Prints a summary of how many new binaries were installed.

Cached archives (with a `.sha256` stamp file in the temp directory) are
reused across runs only while they match the checksum actually expected for
the current build - for rolling entries this means a newer `latest` build is
re-downloaded instead of serving a stale copy.

## Updating sources

### Updating a pinned (non-rolling) version

Applies to macOS targets, which pin an immutable build:

1. Edit `scripts/ffmpeg/sources.json` with the new URL and verified sha256.
   The hashes published by providers may be stale; verify against the actual
   server payload before pinning.
2. Run `pnpm ffmpeg:prepare --force` to re-download and re-verify.
3. Run `pnpm ffmpeg:verify` to confirm.
4. Run `pnpm pack:dir` to build and verify the bundle still includes the
   binaries.

No application code changes are required.

### Updating a rolling (BtbN) target

Windows and Linux track the BtbN `latest` tag automatically - nothing to edit
in `sources.json`. A prepared checkout that is already up to date keeps its
binaries; to force a refresh onto today's build:

```sh
pnpm ffmpeg:prepare --force
```

Do **not** pin BtbN URLs or hashes to a dated daily autobuild: those releases
expire and the checksum goes stale along with the URL.

## Verifying an installed binary

```sh
pnpm ffmpeg:verify        # existence + version + required encoders (native)
pnpm ffmpeg:info          # print version + build configuration
ffmpeg -buildconf         # raw configure line from the binary
```

Rolling builds have no locally pinned hash to compare against: their integrity
was enforced at prepare time (publisher `checksums.sha256` plus, natively,
the static-GPL build assertion). `ffmpeg:verify` re-checks that the prepared
binaries exist, execute, and expose every required encoder.

## License

All builds are GPL-2.0-or-later. The bundled binaries ship with their GPL
license text and a corresponding-source offer under `licenses/ffmpeg/` in the
app bundle. See [licensing.md](licensing.md) for the obligations and rationale.
