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
   `process.resourcesPath` (packaged) or, in development, the project-root
   `resources/` directory through `app.getAppPath()` (`electron-vite dev`
   starts Electron with the project root as app path).

2. **`third_party/ffmpeg → licenses/ffmpeg`** — GPL license text and
   corresponding-source offer (`COPYING.GPLv2`, `SOURCE.txt`). Required by
   the GPL as a condition of redistributing the binaries.

See [licensing.md](licensing.md) for the GPL obligations.

## asar and sharp

The app uses `asar: true` (default). sharp's native `.node` addon cannot be
loaded from inside the asar archive, so `asarUnpack` extracts
`node_modules/sharp/**` into an asar.unpacked directory alongside it.

## Distribution policy: no code signing

Media Converter is an academic, open-source project and is distributed
**without code signing** on every platform. This is an explicit policy, not an
accident:

- `mac.identity: null` makes electron-builder always skip signing, even if a
  certificate happens to exist in the machine's keychain.
- `mac.notarize: false` disables Apple notarization.
- No certificate, Apple Developer account or external signing service is
  required to build or run the app.

Because the builds are unsigned, the operating systems apply their standard
behavior for unsigned software:

- **macOS** — an app that was downloaded (and therefore carries the quarantine
  flag) is rejected by Gatekeeper. macOS may present this as *"…is damaged and
  can't be opened"* or *"Apple cannot check it for malicious software"*. This is
  the expected macOS behavior for any unsigned application and is **not** caused
  by a corrupted or mis-packaged bundle. The only legitimate remedy is a
  Developer ID Application certificate plus Apple notarization, which is
  intentionally out of scope.
- **Windows** — SmartScreen shows an *"Unknown publisher"* warning for the
  unsigned installer. This is expected Windows behavior; it is not bypassed,
  disabled or documented as a step the user must accept. Reputation is only
  built over time by consistently distributing signed artifacts.

## macOS code signing (prepared, not active)

`hardenedRuntime: true` and `build/entitlements.mac.plist` are kept in place so
the bundle is ready for signing if the owner ever adopts a certificate. They
have **no effect while the build is unsigned**:

- `build/entitlements.mac.plist` grants only `com.apple.security.cs.allow-jit`
  (required by Electron/V8 for JIT on arm64). No other entitlement is declared.

## Linux specifics

- The Linux target (`AppImage`, `deb`) bundles everything statically (sharp is
  prebuilt for x64 glibc). AppImage is self-contained; deb places files under
  `/opt/Media Converter/`.
- `category: AudioVideo` is set per freedesktop.org menu spec.

## NSIS (Windows)

The Windows installer is NSIS with `oneClick: false` and
`allowToChangeInstallationDirectory: true`, producing an artifact named
`Media Converter-<version>-win-x64.exe`.

## Updating FFmpeg sources

macOS pins a specific build: edit `scripts/ffmpeg/sources.json`, run
`pnpm ffmpeg:prepare --force`, verify with `pnpm ffmpeg:verify`, then rebuild:

Windows and Linux track BtbN's `latest` tag, so `sources.json` needs no
editing — force a refresh with `pnpm ffmpeg:prepare --force`. See
[ffmpeg.md](ffmpeg.md) for details.

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
- **macOS code signing + notarization** — intentionally **not** configured by
  policy (see "Distribution policy: no code signing" above). Unsigned builds are
  Gatekeeper-blocked when downloaded; the *"app is damaged"* dialog is the
  expected symptom, not a packaging defect.
- **Windows signing** — intentionally **not** configured by policy (no
  certificate). SmartScreen will show "unknown publisher" on the unsigned
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
