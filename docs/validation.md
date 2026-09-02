# Validation Matrix

What has been tested, what is only configured, and what each status means.

## Platform matrix

| Platform | Arch  | Unit tests | Integration tests | Typecheck | Lint | Build | Packaged boot | Status                 |
| -------- | ----- | ---------- | ----------------- | --------- | ---- | ----- | ------------- | ---------------------- |
| macOS    | arm64 | ✅         | ✅                | ✅        | ✅   | ✅    | ✅            | **Validated**          |
| macOS    | x64   | —          | —                 | ✅        | —    | —     | —             | Configured, not tested |
| Windows  | x64   | —          | —                 | ✅        | —    | —     | —             | Configured, not tested |
| Linux    | x64   | —          | —                 | ✅        | —    | —     | —             | Configured, not tested |

**Validated** means the full check suite passed (unit tests, integration tests,
typecheck, lint, format, deps check, license audit), the production build
succeeded, and the packaged app launched on real hardware.

**Configured, not tested** means the platform is wired into the build
(`electron-builder.yml` targets, `scripts/ffmpeg/sources.json` entries,
platform detection in `src/platform/`) but no one has run the checks or launched
the packaged app on that platform.

## What each check covers

| Check             | Command                 | What it catches                                                                                                |
| ----------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Unit tests        | `pnpm test`             | Domain logic, IPC wiring, job/queue state machine, args, progress parsing (61 tests, no native modules loaded) |
| Integration tests | `pnpm test:integration` | Real-binary conversion, cancel, progress, output file presence — requires FFmpeg to be prepared                |
| Typecheck         | `pnpm typecheck`        | Type errors in all process layers (renderer via vue-tsc, main/preload via tsc)                                 |
| Lint              | `pnpm lint`             | ESLint rule violations across all JS/TS/Vue files                                                              |
| Format            | `pnpm format:check`     | Prettier formatting consistency                                                                                |
| Deps check        | `pnpm deps:check`       | All prod deps are in the allowlist, all versions are pinned exactly, lockfile present                          |
| License audit     | `pnpm licenses:check`   | No GPL/AGPL/SSPL/BUSL in production dep tree; LGPL triggers a warning                                          |
| Build             | `pnpm build`            | electron-vite production build succeeds (main + renderer + preload)                                            |
| Pack              | `pnpm pack:dir`         | electron-builder produces a runnable directory with all extraResources and asarUnpack                          |
| Boot smoke        | Manual launch           | Packaged app launches, resolves ffmpeg, renders UI without crash                                               |

## Known limitations

1. **No code signing**: macOS builds are unsigned. Gatekeeper blocks launch
   until the user bypasses it. Distribution requires a Developer ID certificate.
2. **No notarization**: Apple notarization is not configured. Required for
   smooth macOS distribution.
3. **Hardened runtime entitlements**: `allow-jit` and `automation.apple-events`
   are granted; no network or filesystem entitlements are declared.
4. **FFmpeg binaries not tested on other platforms**: the Linux and Windows
   binaries have never been exercised on actual hardware. Format support and
   codec availability may differ (see `ffmpeg -buildconf`).
5. **sharp image matrix**: image conversion is validated via the sharp smoke
   test (`scripts/smoke/sharp-convert.mjs`) but not via integration tests.
   PNG → WEBP/AVIF/JPEG conversion passes; other combinations are untested.

## Running the full check suite

The following commands must pass before any release:

```sh
pnpm test                  # unit tests
pnpm test:integration      # real-binary integration tests
pnpm typecheck             # type errors
pnpm lint                  # lint violations
pnpm format:check          # formatting
pnpm deps:check            # dependency hygiene
pnpm licenses:check        # license compliance
pnpm build                 # production build
pnpm pack:dir              # bundled app (quick check)
```

A packaged boot smoke test (launch the app, confirm startup logs include
`packaged=true` and `ffmpeg resolved`) should be performed on the target
platform before shipping.

## Regression protection

Every change that touches application code or dependencies should pass at
minimum: `pnpm test`, `pnpm typecheck`, `pnpm lint`. Changes to native
dependencies or the build pipeline should additionally pass `pnpm pack:dir`
and a packaged boot.
