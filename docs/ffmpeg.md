# FFmpeg Toolchain

How the static FFmpeg/ffprobe binaries are fetched, verified, installed and
shipped.

## Overview

Media Converter does not include FFmpeg in source control. Binaries are
downloaded on demand, verified against pinned sha256 hashes, and installed
under `resources/ffmpeg/<platform-arch>/`. They are then shipped in the
application bundle via electron-builder `extraResources`.

The full pipeline is driven by npm scripts:

| Script                | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| `pnpm ffmpeg:prepare` | Download + extract + sha256-verify for the current platform |
| `pnpm ffmpeg:verify`  | Confirm installed binaries match the pinned hashes          |
| `pnpm ffmpeg:info`    | Print installed FFmpeg version and build configuration      |

## Source registry — `scripts/ffmpeg/sources.json`

Every target platform-arch has an entry listing the URLs and pinned sha256
hashes for the `ffmpeg` and `ffprobe` binaries:

```json
{
  "darwin-arm64": {
    "platform": "darwin",
    "arch": "arm64",
    "files": [
      { "url": "…", "sha256": "…", "match": "ffmpeg" },
      { "url": "…", "sha256": "…", "match": "ffprobe" }
    ]
  }
}
```

The `match` field is the binary filename to extract from the archive. The
`prepare.mjs` script walks the extracted tree until it finds that exact name
and copies only that file to the target directory.

## Pinned sources (current)

| Platform     | Provider           | Build                                 | License          |
| ------------ | ------------------ | ------------------------------------- | ---------------- |
| darwin-arm64 | osxexperts.net     | FFmpeg 9.0 (built 2026-07-07, arm64)  | GPL-2.0-or-later |
| darwin-x64   | osxexperts.net     | FFmpeg 8.0 (x86_64, Intel)            | GPL-2.0-or-later |
| win32-x64    | BtbN/FFmpeg-Builds | autobuild-2026-08-30, ffmpeg-N-126335 | GPL-2.0-or-later |
| linux-x64    | BtbN/FFmpeg-Builds | autobuild-2026-08-30, ffmpeg-N-126335 | GPL-2.0-or-later |

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
   - Downloads the archive to a temp directory.
   - Verifies the sha256 against the pinned hash. Fails hard on mismatch.
   - Extracts the archive (zip on macOS/Windows, tar.xz on Linux).
   - Walks the extracted tree for the exact filename in `match`.
   - Copies the binary to `resources/ffmpeg/<target>/<filename>`.
   - On macOS, strips the quarantine attribute (`xattr -dr com.apple.quarantine`).
   - On Unix, sets the executable bit (`chmod +x`).
3. Prints a summary of how many new binaries were installed.

Cached archives (with a `.sha256` stamp file in the temp directory) are
reused across runs to avoid re-downloading when nothing changed.

## Updating a pinned version

1. Edit `scripts/ffmpeg/sources.json` with the new URL and verified sha256.
   The hashes published by providers may be stale; verify against the actual
   server payload before pinning.
2. Run `pnpm ffmpeg:prepare --force` to re-download and re-verify.
3. Run `pnpm ffmpeg:verify` to confirm.
4. Run `pnpm pack:dir` to build and verify the bundle still includes the
   binaries.

No application code changes are required.

## Verifying an installed binary

```sh
pnpm ffmpeg:verify        # check sha256 against sources.json
pnpm ffmpeg:info          # print version + build configuration
ffmpeg -buildconf         # raw configure line from the binary
```

## License

All builds are GPL-2.0-or-later. The bundled binaries ship with their GPL
license text and a corresponding-source offer under `licenses/ffmpeg/` in the
app bundle. See [licensing.md](licensing.md) for the obligations and rationale.
