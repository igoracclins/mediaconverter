# Packaging & Distribution

How the app is bundled for distribution via electron-builder.

## Building

```sh
pnpm pack:dir    # unpacked directory (fast, for testing)
pnpm dist        # full installer/artifact output
```

Both run `electron-vite build` first, then electron-builder. The config lives in
`electron-builder.yml` at the project root.

## Targets

| Platform | Format         | Arch  | Status                                         |
| -------- | -------------- | ----- | ---------------------------------------------- |
| macOS    | DMG + zip      | arm64 | Validated (see [validation.md](validation.md)) |
| Windows  | NSIS installer | x64   | Configured, not tested                         |
| Linux    | AppImage + deb | x64   | Configured, not tested                         |

Artifacts are written to `dist/`.

## Bundle structure (macOS arm64 example)

```
dist/mac-arm64/Media Converter.app/
  Contents/
    Resources/
      ffmpeg/
        darwin-arm64/ffmpeg       ← static binary (GPL-2.0-or-later)
        darwin-arm64/ffprobe
      licenses/ffmpeg/
        COPYING.GPLv2            ← GPL license text (GPL conveyance)
        SOURCE.txt               ← provenance + source offer (GPL conveyance)
      node_modules/
        sharp/...                ← asar-unpacked (native .node addon)
        .../
      package.asar               ← renderer + main code (unpacked via asarUnpack for sharp)
```

## Extra resources

`extraResources` in `electron-builder.yml` copies two trees into the app
bundle (outside the asar):

1. **`resources/ffmpeg → ffmpeg`** — the static FFmpeg/ffprobe binaries
   fetched by `pnpm ffmpeg:prepare`. The main process resolves them via
   `process.resourcesPath` (packaged) or `import.meta.dirname` (dev).

2. **`third_party/ffmpeg → licenses/ffmpeg`** — GPL license text and
   corresponding-source offer (`COPYING.GPLv2`, `SOURCE.txt`). Required by
   the GPL as a condition of redistributing the binaries.

See [licensing.md](licensing.md) for the GPL obligations.

## asar and sharp

The app uses `asar: true` (default). sharp's native `.node` addon cannot be
loaded from inside the asar archive, so `asarUnpack` extracts
`node_modules/sharp/**` into an asar.unpacked directory alongside it.

## macOS code signing

- **Hardened runtime** is enabled (`hardenedRuntime: true`).
- `build/entitlements.mac.plist` grants two entitlements:
  - `com.apple.security.cs.allow-jit` — required by Electron/V8.
  - `com.apple.security.automation.apple-events` — used by the app if needed
    for external automation.
- **No Developer ID certificate** is configured. When run on an unsigned build
  on macOS 12+, Gatekeeper blocks the launch unless the user right-click → Open
  or removes the quarantine attribute. In production, signing + notarization
  with an Apple Developer ID are required before distribution.
- `ffmpeg -version` on macOS shows no quarantine attributes after prepare strips
  them with `xattr -dr com.apple.quarantine`.

## Linux specifics

- The Linux target (`AppImage`, `deb`) bundles everything statically (sharp is
  prebuilt for x64 glibc). AppImage is self-contained; deb places files under
  `/opt/Media Converter/`.
- `category: AudioVideo` is set per freedesktop.org menu spec.

## NSIS (Windows)

The Windows installer is NSIS with `oneClick: false` and
`allowToChangeInstallationDirectory: true`, producing an artifact named
`Media Converter-<version>-win-x64.exe`.

## Updating pinned FFmpeg

Edit `scripts/ffmpeg/sources.json`, run `pnpm ffmpeg:prepare --force`, verify
with `pnpm ffmpeg:verify`, then rebuild:

```sh
pnpm pack:dir
```

No code changes needed — only the binary + hashes change. See [ffmpeg.md](ffmpeg.md).

## Release blockers (public / commercial distribution)

These are intentionally documented as **pending** — none are claimed resolved,
and none should be invented without the project owner's decisions:

- **appId is a placeholder** — `electron-builder.yml` currently uses
  `com.example.mediaconverter`. A real, owned reverse-DNS identifier is needed
  before public release (drives macOS bundle id, Windows app identity, code
  signing). Do not fabricate a domain/company.
- **macOS code signing + notarization** — no Developer ID certificate is
  configured. Unsigned builds are Gatekeeper-blocked until signed and
  notarized by the owner.
- **Windows signing** — no certificate; SmartScreen will warn on an unsigned
  installer.
- **CI** — no pipeline is configured; release builds are produced manually.
- **Definitive icon** — the official app icon is configured in `build/`
  (icon.svg source + icon.png) and is applied to the macOS and Windows builds by
  electron-builder via the `buildResources` directory.
- **Physical validation on Windows/Linux** — targets are configured and
  portability is prepared in code, but have not been executed in this
  environment (macOS ARM64 only).
- **Legal/patent review** — see [licensing.md](licensing.md) §7; H.264/AAC
  patent pools, libvips LGPL relink, and exact binary license version need
  review before commercial distribution.
