# Development Guide

How to set up, develop and verify Media Converter locally.

## Prerequisites

| Tool                 | Version                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| Node.js              | ≥ 20.19 (LTS recommended)                                              |
| pnpm                 | ≥ 10                                                                   |
| Platform build tools | Xcode CLT (macOS), MSYS2 + mingw-w64 (Windows), GCC + Python 3 (Linux) |

Xcode CLT and `pnpm` global install are enough on macOS. On Windows/Linux, C++
compilers are required for sharp's prebuild and Electron's native addons.

## First-time setup

```sh
pnpm install          # installs JS deps + rebuilds native modules for Electron
pnpm ffmpeg:prepare   # downloads + verifies FFmpeg for the current platform
```

After that the dev server starts with:

```sh
pnpm dev
```

> `resources/ffmpeg/` is gitignored and platform-scoped: the binaries prepared
> for one machine are never carried over to another. Run `pnpm ffmpeg:prepare`
> once on **every** machine where you develop (a freshly cloned Windows
> checkout needs it too). Starting `pnpm dev` without it makes every
> FFmpeg-backed job fail immediately with `FFMPEG_NOT_FOUND`
> (*"Não foi possível iniciar o mecanismo de conversão…"*), even though the
> installed application works — the installer ships the binaries via
> `extraResources`. `pnpm ffmpeg:verify` reports any platform that was not
> prepared for.
>
> Windows and Linux binaries are tracked through BtbN's permanent `latest` tag
> (see [ffmpeg.md](ffmpeg.md)); preparation does not depend on a dated build, so
> a fresh clone can always run `pnpm ffmpeg:prepare`.

### pnpm allowBuilds (pnpm ≥ 10.18)

pnpm 10 requires a build allowlist. The file `pnpm-workspace.yaml` contains an
`allowBuilds.packages` map listing every package that runs a postinstall build
script (sharp, electron, esbuild, etc.). When a new native dependency is added,
its name must be inserted there or `pnpm install` refuses to build it.

## Key commands

| Command                                                 | What it does                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                                              | electron-vite dev server with HMR                               |
| `pnpm build`                                            | production Vite build (Electron main + renderer) to `out/`      |
| `pnpm start`                                            | launch the production build (preview)                           |
| `pnpm test`                                             | unit tests (Vitest, no native modules loaded)                   |
| `pnpm test:integration`                                 | real-binary integration tests (requires `pnpm ffmpeg:prepare`)  |
| `pnpm test:watch`                                       | unit tests in watch mode                                        |
| `pnpm typecheck`                                        | `vue-tsc` (renderer) + `tsc` (main/preload)                     |
| `pnpm lint` / `pnpm lint:fix`                           | ESLint                                                          |
| `pnpm format` / `pnpm format:check`                     | Prettier                                                        |
| `pnpm ffmpeg:prepare`                                   | download + verify FFmpeg for current platform                     |
| `pnpm ffmpeg:verify`                                    | confirm prepared binaries run with all required encoders |
| `pnpm ffmpeg:info`                                      | print installed FFmpeg version + build config                   |
| `pnpm deps:check`                                       | verify all prod deps are in the allowlist and pinned            |
| `pnpm licenses:check`                                   | audit production dep licenses (hard-fails on GPL/AGPL)          |
| `pnpm licenses:check -- --write THIRD-PARTY-NOTICES.md` | same + regenerate the notices file                              |
| `pnpm pack:dir`                                         | build + electron-builder (unpacked directory only, quick check) |
| `pnpm dist`                                             | build + full installer/artifact output                          |

## Running integration tests

Integration tests spawn the real FFmpeg binary and convert audio/video
files. They require the FFmpeg toolchain to be prepared first:

```sh
pnpm ffmpeg:prepare
pnpm test:integration
```

The integration test config is `vitest.integration.config.ts` (separate from
the unit test config) so unit tests stay fast and never load native modules.

## Architecture

See [architecture.md](architecture.md) for the process model, safety model
and domain design. The source tree follows the Electron process layers:

```
src/
  core/          platform-free domain logic (detection, jobs, queue)
  conversion/    engines (ffmpeg / sharp), progress, orchestration
  platform/      platform detection, process spawning, path helpers
  main/          Electron main process (IPC, window, manager, dialogs)
  preload/       contextBridge API
  renderer/      Vue UI
  shared/        types and format tables shared across processes
```

## Sharp native module

sharp is loaded lazily in the conversion service so the Electron-ABI build is
never imported in unit tests or typechecks. In production the right
prebuild (`@img/sharp-<platform>-<arch>`) is resolved by Node's module loader.
See [architecture.md](architecture.md#engines-srcconversion) for details.

## Changing FFmpeg pinned versions

Edit `scripts/ffmpeg/sources.json` and run:

```sh
pnpm ffmpeg:prepare --force   # re-downloads and re-verifies
```

The binary is never modified — only the sha256 pinned at pinning time changes.
See [ffmpeg.md](ffmpeg.md) for the full toolchain.

## Debugging

- **Main process**: launch with `--inspect-brk` and attach DevTools.
- **Renderer**: open DevTools from the app menu (View → Toggle DevTools).
- **FFmpeg arguments**: set `FFMPEG_DEBUG=1` to print the full argv to stderr
  before spawning.
