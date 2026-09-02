# Architecture

Media Converter is an Electron application split into four standard process layers plus a
dependency-light "core" that both sides can share.

## Process model

```
┌──────────────────────────── Electron ───────────────────────────┐
│ Renderer (Vue 3, Vite)                                          │
│   App.vue ── DropZone / DraftList / QueueList                    │
│        │                                                         │
│        ▼ preload (contextBridge, sandboxed)                      │
│   window.api  ── invoke("ipc:channel", payload)                  │
│        │                                                         │
│        ▼ main (Node)                                             │
│   ipc/register ── ConversionManager ── ConversionService         │
│        │              │                 ├─ ffmpeg engine (subprocess)
│        │              ▼                 └─ sharp engine (lazy)
│   Window services (dialogs, app info, file inspect)              │
└──────────────────────────────────────────────────────────────────┘
```

- **Renderer**: can never touch the filesystem. Dragged files arrive as `File` objects and are
  resolved to absolute paths by the preload via `webUtils.getPathForFile` (Electron ≥ 29).
- **Preload**: the only bridge. Exposes a small typed API (see `src/shared/ipc.ts`,
  `RendererApi`) over `ipcRenderer.invoke`. Runs sandboxed with context isolation on.
- **Main**: owns the queue, spawns conversion processes, resolves output paths, shows dialogs,
  and broadcasts queue snapshots to every window.

## Safety model

| Concern          | Mechanism                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Rendering        | `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`; strict CSP in `src/renderer/index.html`                 |
| Paths            | Every IPC input is shape-validated in `register.ts`; file inspection is limited to supported media extensions (`detectPath`) |
| Output collision | `resolveAndReserveOutput` re-checks the filesystem at enqueue time and appends ` (1)`, ` (2)`, …                             |
| No overwrites    | ffmpeg runs with `-n` (never overwrite); output exists → reserved path is incremented                                        |
| Cancellation     | kill the child (SIGKILL) and delete the partial output; jobs settle to `cancelled`                                           |
| Secrets          | none loaded; no credentials or network in the app                                                                            |

## Domain core (`src/core`)

- `detect.ts` — extensions → `MediaCategory` / `TargetFormat`, plus `detectPath` used by both the
  renderer preview and the main-process gate.
- `filenames.ts` — `splitExtension`, `withoutExtension`, unsafe-char stripping for output names.
- `suggest.ts` — source extension → suggested target format (MP3 → WAV, WAV → MP3, MP4 → MKV, …).
- `job.ts` — pure job state machine: `pending → processing → completed|failed|cancelled`, with
  terminal-state guards and progress clamping.
- `queue.ts` — ordered FIFO queue with cancel semantics (`next()`, `requestCancel()`, `replace()`).

`core` imports nothing but `shared` (types + format tables), so it runs in any process and stays
unit-testable.

## Engines (`src/conversion`)

- `engine.ts` defines `ConversionTask`, `EngineHandle` (`finished` promise + `cancel()`),
  `EngineRunResult` and the `EngineBundle`.
- **ffmpeg** (`ffmpeg/`): `args.ts` builds the argument vector (no shell, absolute paths,
  output options after the input URL); `progress.ts` parses `-progress pipe:1` speed/output lines;
  `probe.ts` measures duration for progress via ffprobe; `engine.ts` manages the child lifecycle.
- **sharp** (`sharp/`): image engine, imported lazily so the Node-ABI build never loads in tests
  or typechecks; in production the Electron-ABI binary is picked up automatically.
- `service.ts` — `createEngineBundle` + `ConversionService.execute()` that routes by category.

## Main process services

- `conversion-manager.ts` — owns a `JobQueue`, runs `concurrency` jobs (default 2), maps engine
  results onto job states (`JOB_CANCELLED → cancelled`), and broadcasts `queue:updated` snapshots.
- `output-resolver.ts` — input validation + collision-safe output path reservation.
- `app-info.ts` — cached `AppInfo` incl. ffmpeg presence/version probe.
- `file-service.ts` — inspect files/dialogs, reachable from IPC only.

## Rendering

Vue 3 via `<script setup>`, Tailwind v4 (`@theme` tokens in `assets/main.css`), single window.
Drafts are built in the renderer after `inspectFiles`; converting moves them into the main queue
and the draft list clears. `useQueue` subscribes to `queue:updated` and turns error codes into
human-readable messages.

## IPC channels

All channels are declared once in `src/shared/ipc.ts` (`IPC` constants) so main, preload and
renderer can never drift:

`app:info`, `dialog:open-files`, `dialog:pick-destination`, `files:inspect`,
`conversion:start`, `conversion:cancel-job`, `conversion:cancel-all`,
`queue:clear-completed`, `queue:updated` (main → renderer, event broadcast).

Payload shapes (`QueueSnapshot`, `StartConversionRequest`, `StartConversionResult`,
`FileDescriptor`) are shared and validated on the main side.
