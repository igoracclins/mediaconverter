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

## Code signing & notarization (production)

Production artifacts are signed and notarized **only when real credentials are
provided at build time** via environment variables / CI secrets. Without them,
electron-builder skips signing and the build stays unsigned — so development
(`pnpm dev`) and internal builds work with no certificates at all. Signing only
affects the distribution artifacts; it never changes how the app runs, and no
backend, server or runtime dependency is introduced.

**Credential policy:** certificates, private keys and secrets are never stored
or committed in this repository (see `.gitignore`). They come exclusively from
the environment. If you do not (yet) have the credentials below, the project is
still buildable — the signed release is simply not produced until you provide
them.

### macOS — Developer ID signing

`hardenedRuntime: true` is set and `build/entitlements.mac.plist` grants only
the entitlements the app actually needs (table below). Because no
`mac.identity` is hard-coded, electron-builder searches for a **Developer ID
Application** certificate and signs everything in the bundle:

1. the `.app` bundle and its `Info.plist`;
2. the Electron framework and all helper apps
   (`Media Converter Helper*.app`, GPU/Plugin/Renderer);
3. every Mach-O inside the bundle — including the bundled GPL binaries
   `Contents/Resources/ffmpeg/darwin-arm64/ffmpeg` and `ffprobe` — so the
   nested-code signature is valid and complete.

The signing identity can be supplied any of these ways:

| Method                                    | How it is provided                                   |
| ----------------------------------------- | ---------------------------------------------------- |
| Certificate in the macOS keychain         | nothing to do — it is auto-discovered                |
| `CSC_NAME`                                | common name of the certificate in the keychain       |
| `CSC_LINK` + `CSC_KEY_PASSWORD`           | `CSC_LINK` = `https://` URL or file path of a `.p12` |

**Notarization + stapling.** After signing, electron-builder submits the
`.app` to Apple's `notarytool` and **staples the ticket** into the bundle
automatically. The enforced order is: sign the `.app` → notarize → staple →
then build the DMG and ZIP from that validated `.app`. The DMG itself is
intentionally left unsigned (`dmg.sign` defaults to `false`); notarization
covers the `.app` inside it, which is exactly what macOS checks on launch.

Notarization credentials — any **one** of these sets is accepted:

| Option | Environment variables                                  |
| ------ | ------------------------------------------------------ |
| 1 (recommended) | `APPLE_API_KEY` (base64 of the `.p8`), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` |
| 2      | `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` |
| 3      | `APPLE_KEYCHAIN`, `APPLE_KEYCHAIN_PROFILE`             |

#### Why these entitlements

| Entitlement | Reason it is needed |
| --- | --- |
| `com.apple.security.cs.allow-jit` | Electron/V8 allocates JIT regions on arm64; required for the app to run under hardened runtime. |
| `com.apple.security.cs.allow-unsigned-executable-memory` | Electron may map writable+executable memory for its runtime; documented prerequisite of hardened runtime for Electron (**electron-notarize prerequisites**). |
| `com.apple.security.cs.disable-library-validation` | Needed to load the `sharp` native addon (`sharp.node`, shipped in `app.asar.unpacked`), whose binary is not signed with the app's Team ID. Without it, hardened runtime's library validation rejects the addon and the app fails to start. |

No network, filesystem, sandbox or other `com.apple.security.*` entitlement is
granted. (`entitlementsInherit` points to the same file, which is the standard
pattern for signing electron-builder helpers.)

### Windows — Authenticode signing

The certificate is supplied via environment variables:

| Variable | Meaning |
| --- | --- |
| `WIN_CSC_LINK` | `https://` URL or file path of the `.p12`/`.pfx` certificate |
| `WIN_CSC_KEY_PASSWORD` | password of that certificate |

The publisher name is read from the real certificate at signing time — it is
never faked or hard-coded. electron-builder signs the application `.exe`, the
NSIS elevation helper, the generated uninstaller and the final
`Media Converter-<version>-win-x64.exe`, each with an RFC 3161 timestamp
(server default: DigiCert). When building on a non-Windows host, a bundled
`osslsigncode` is used automatically, so cross-building from macOS works with
no extra setup.

**SmartScreen.** Authenticode signing identifies you as the publisher, but it
is not a guarantee that SmartScreen stops warning immediately — reputation is
built over time through consistent, signed releases. This project does not
provide any bypass, and neither disables nor instructs the user to disable
SmartScreen, Defender, Gatekeeper or quarantine.

### Linux

Unchanged: AppImage + deb, never signed and with no signing requirement.

### Behavior without credentials

- `pnpm dev` never touches electron-builder, so it is entirely credential-free.
- `pnpm dist` / `pack:*` without a signing identity produce **unsigned** builds:
  electron-builder logs `skipped macOS application code signing` (macOS) and
  simply skips the Windows sign step. Notarization is skipped too when no Apple
  credentials are present.
- To make a *release* fail instead of silently emitting an unsigned artifact,
  you can set `forceCodeSigning: true` in `electron-builder.yml`. It is **not**
  enabled by default so credential-less local builds keep working.

### Verifying a signed release

macOS:

```sh
codesign -dv --verbose=4 "dist/mac-arm64/Media Converter.app"
codesign --verify --deep --strict --verbose=2 "dist/mac-arm64/Media Converter.app"
spctl -a -t exec -vv "dist/mac-arm64/Media Converter.app"
xcrun stapler validate "dist/mac-arm64/Media Converter.app"
```

Windows:

```sh
signtool verify /pa /v "dist/Media Converter-<version>-win-x64.exe"
# or, cross-platform:
osslsigncode verify "dist/Media Converter-<version>-win-x64.exe"
```

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
- **macOS code signing + notarization** — fully configured (see
  "Code signing & notarization (production)" above) but **not exercised**:
  the owner must provide a Developer ID Application certificate and Apple
  notarization credentials. Until then, release builds remain unsigned and
  Gatekeeper-blocked when downloaded.
- **Windows signing** — fully configured to pick up `WIN_CSC_LINK` /
  `WIN_CSC_KEY_PASSWORD` but **not exercised**: the owner must provide an
  Authenticode certificate. Until then the installer is unsigned and SmartScreen
  shows "unknown publisher".
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
