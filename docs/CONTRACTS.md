# fileCon — Contracts

Status: draft v1 · Related: [Architecture](ARCHITECTURE.md) · [Flows](FLOWS.md) · [TRD](TRD.md) · [Index](INDEX.md)

**The code in `core/src/types/` is the single source of truth** for types, messages, error codes and settings. This file explains them and links to it, and holds the tables (RPC methods, IPC channels, error texts, settings rules, text keys). Other docs refer to these names and never redefine them. If code and this file disagree, the code wins and this file is fixed in the same change.

All types are JSON-serializable unless they're marked *(in-process only)*.

Each section has its own file under `core/src/types/`, written as zod schemas for what crosses a process boundary (options, settings, job requests, errors) with the types taken from `z.infer`, and as plain TypeScript for in-process interfaces: 1 `domain.ts`, 2 `options.ts`, 3 `detect.ts`, 4 `jobs.ts`, 5 `errors.ts`, 6 `rpc.ts`, 7 `ipc.ts`, 8 `settings.ts`, 9 `engines.ts`, 10 `text.ts`. `types/index.ts` re-exports them all. Core checks RPC params with the schemas in `rpc/protocol.ts`, and main checks IPC payloads and settings with the same schemas.

## 1. Domain types

The types are in [`core/src/types/domain.ts`](../packages/core/src/types/domain.ts).

## 2. Options

The types are in [`core/src/types/options.ts`](../packages/core/src/types/options.ts).

- Validation happens in core at `submit`. Out-of-range values fail with `INVALID_REQUEST`, never silently clamped.
- A converter ignores keys that aren't in its edge's `options` list.
- Images are always turned upright from their EXIF orientation first, so stripping metadata never leaves a photo sideways.
- **`pages` grammar:** a comma-separated list of `N`, `N-M`, `N-` (to the end) or `-M` (from page 1). Spaces are ignored. Numbers are ≥ 1 and `N ≤ M`. The result is normalized to sorted, merged ranges.
  - Bad syntax gives `INVALID_REQUEST` at `submit`.
  - Pages past the end are checked at run time against the real page count, and give `INVALID_REQUEST` with params `{ what: "page-past-end", page: 9, count: 5 }`.
  - Output files are named by the **real page number** (`page-003`), not by their position in the list.
- The UI shows an option only if some step of the chosen route lists it.
- shortcut: this is a fixed set with no per-converter schema. Upgrade to a declared schema per edge when the ffmpeg codec and bitrate options arrive (M1.1).

## 3. Detection and planning

The types are in [`core/src/types/detect.ts`](../packages/core/src/types/detect.ts).

## 4. Jobs

The types are in [`core/src/types/jobs.ts`](../packages/core/src/types/jobs.ts).

`progress.unit` and `progress.total` count steps for a convert job, inputs + 1 for a merge job, and 1 for an extract job.

**Legal transitions.** Anything else is a bug:

| From | To | Trigger |
|---|---|---|
| (new) | queued | `submit` accepted |
| queued | running | scheduler grants a slot |
| queued | cancelled | `cancel` / `cancelAll` |
| running | done | outputs committed |
| running | failed | any step or commit error, `TIMEOUT`, `CORE_CRASHED` (set by main) |
| running | cancelled | `cancel` / `cancelAll`, after the engine is killed and cleanup finishes |

`done`, `failed` and `cancelled` are terminal. `ACTIVE_STATES`, `TERMINAL_STATES` and the `isActive` and `isTerminal` checks in `types/jobs.ts` are the one list that core, the supervisor and the renderer share. Retry means submitting a new job, which gets a new id.

## 5. Errors

The types are in [`core/src/types/errors.ts`](../packages/core/src/types/errors.ts).

- Params use these names only: `name` (file name, no directories), `engine`, `pack`, `from`, `to`, `dir`, `what`. `what` is an id, not prose: its text is `translate("invalid.<what>")`, plus any extra numeric params it needs (`page-past-end` adds `page` and `count`).
- Logs write `code` and `params`, never translated text.
- The English column below is the source for `en.json` key `error.<CODE>`. The app owns that text, core never sends it.

| Code | Raised when | English text (`en.json` `error.<CODE>`) | Retryable |
|---|---|---|---|
| `INVALID_REQUEST` | Malformed params, bad option range, unknown combiner | "Invalid request". When `what` is set the UI shows `translate("invalid.<what>", params)` instead | no |
| `INPUT_NOT_FOUND` | Path missing at detect or job start | "{name} no longer exists" | no |
| `INPUT_UNREADABLE` | EACCES, EPERM, or the path is a directory or special file | "Can't read {name}" | no |
| `EMPTY_FILE` | size = 0 | "{name} is empty" | no |
| `UNSUPPORTED_FORMAT` | Detection gives no known format | "{name}: format not supported" | no |
| `INPUT_ENCRYPTED` | PDF is password-protected (`pdfinfo` reports encryption that blocks reading) | "{name} is password-protected" | no |
| `NO_ROUTE` | No route within 3 hops, even on the full graph | "Can't convert {from} to {to}" | no |
| `ENGINE_MISSING` | Route needs an engine that isn't available | "Needs the {pack} pack ({engine})" | after install |
| `ENGINE_FAILED` | Engine exited non-zero or threw | "{engine} failed to convert {name}" | yes |
| `ENGINE_OUTPUT_MISSING` | Engine reported success but produced no non-empty file | "{engine} produced no output for {name}" | yes |
| `TIMEOUT` | Step exceeded `timeoutMs` | "{engine} timed out on {name}" | yes |
| `CANCELLED` | User cancelled | "Cancelled" | yes |
| `OUTPUT_DIR_NOT_WRITABLE` | The output folder can't be written. Checked when the job starts, before any step runs | "Can't write to {dir}" | after fix |
| `OUTPUT_WRITE_FAILED` | Commit failed, or 999 name conflicts | "Couldn't save {name}" | yes |
| `DISK_FULL` | ENOSPC anywhere | "Disk full" | after fix |
| `CORE_CRASHED` | Core host exited while the job was running (set by main) | "Converter process crashed" | yes |
| `CORE_UNAVAILABLE` | Restart budget exhausted. Every call fails fast | "Converter unavailable, restart the app" | no |
| `CORE_TIMEOUT` | A call (other than `init`, `submit`, `cancel`, `shutdown`) got no answer from the core host in 30 s (set by main). The host is not restarted | "The converter didn't answer, try again" | yes |
| `NOTHING_TO_EXTRACT` | Extractor found nothing (e.g. a PDF with no embedded images in the chosen pages) | "No embedded images found in {name}" | no |
| `INSTALL_FAILED` | Engine download, network or unzip failed, or the binaries weren't found afterwards | "Couldn't install {engine}" | yes |
| `CHECKSUM_MISMATCH` | Downloaded archive's SHA-256 differs from the pinned value. The file is deleted | "Download of {engine} was corrupted or tampered with" | yes |

## 6. Core RPC protocol

Main ⇄ Core host. The transport is the utilityProcess `parentPort` (structured clone of plain JSON). The Tauri port uses stdio with newline-delimited JSON, carrying the same envelopes.

The types are in [`core/src/types/rpc.ts`](../packages/core/src/types/rpc.ts).

| Method | Params | Result | Notes |
|---|---|---|---|
| `init` | `{ settings: Settings; dataDir: string }` | `void` | First call. `dataDir` is the app's data folder (Electron `userData`): engine installs and the LibreOffice profile live there. Sweeps temp, discovers engines, builds graph, then emits `ready` |
| `detect` | `{ paths: string[] }` | `DetectResult[]` | Same order. A per-file error goes in `DetectResult.error`, not a rejection |
| `targets` | `{ formats: Format[] }` | `TargetsResult` | Intersection over all formats |
| `plan` | `{ from: Format; to: Format }` | `Route \| null` | Used for tooltips and debugging |
| `submit` | `{ requests: JobRequest[] }` | `SubmitResult` | Validates everything first. Any invalid request rejects the whole call with `INVALID_REQUEST` and nothing is queued |
| `cancel` | `{ jobId: string }` | `void` | No-op if the job is terminal or unknown |
| `cancelAll` | `{}` | `void` | |
| `engines.list` | `{}` | `EngineInfo[]` | |
| `engines.refresh` | `{}` | `EngineInfo[]` | Re-probes, rebuilds graph, emits `engines.changed` |
| `engines.install` | `{ engineId: string }` | `EngineInfo` | Only for `install[platform].kind = "download"`. Downloads, verifies, unpacks, re-discovers, emits `engines.changed`. One install at a time per engine. Any other kind gives `INVALID_REQUEST` |
| `settings.apply` | `{ settings: Settings }` | `void` | Re-probes if engine paths changed. New concurrency applies to queued jobs |
| `shutdown` | `{}` | `void` | cancelAll, cleanup, resolve, and then the host exits |

| Event | Data | Notes |
|---|---|---|
| `ready` | `{ engines: EngineInfo[] }` | After `init` completes |
| `job.update` | `Job` | Throttled to 10/s per job. State changes and terminal states are sent immediately |
| `engines.changed` | `EngineInfo[]` | After refresh, settings change or install |
| `engine.install.progress` | `{ engineId: string; phase: "download" \| "verify" \| "unpack" \| "probe"; received?: number; total?: number }` | Throttled to 10/s |
| `log` | `{ level: "debug" \| "info" \| "warn" \| "error"; msg: string; jobId?: string }` | Main writes to the log file |

Rules:
- `id`s are assigned by main, increase monotonically and are never reused per host instance.
- Requests may be answered out of order.
- An unknown method gets `INVALID_REQUEST`.
- Before `ready`, every method except `init` and `shutdown` gets `CORE_UNAVAILABLE`.

## 7. IPC (renderer ⇄ main)

The preload exposes `window.filecon` through `contextBridge`. Every method calls `ipcRenderer.invoke(channel, payload)`. A failed call rejects with the plain `CoreError` (`code` and `params`), never an `Error`, because only the message of an `Error` survives IPC.

| `window.filecon.` | Channel | Payload → Result | Main does |
|---|---|---|---|
| `detect(paths)` | `core:detect` | `string[]` → `DetectResult[]` | Validate paths, then relay `detect` |
| `targets(formats)` | `core:targets` | `Format[]` → `TargetsResult` | Relay |
| `submit(requests)` | `job:submit` | `JobRequest[]` → `SubmitResult` | Validate every input and outDir, then relay |
| `cancel(jobId)` | `job:cancel` | `string` → `void` | Relay |
| `cancelAll()` | `job:cancelAll` | → `void` | Relay |
| `engines()` | `engines:list` | → `EngineInfo[]` | Relay |
| `refreshEngines()` | `engines:refresh` | → `EngineInfo[]` | Relay |
| `installEngine(id)` | `engines:install` | `string` → `EngineInfo` | Shows a native confirm dialog (engine, size, source host) first. If declined, rejects with `CANCELLED`. Otherwise relays `engines.install` |
| `openFiles()` | `dialog:openFiles` | → `string[]` | Native dialog, multi-select |
| `chooseDir()` | `dialog:chooseDir` | → `string \| null` | Native dialog |
| `chooseEngine(id)` | `dialog:chooseEngine` | `string` → `string \| null` | Native file dialog. The result is saved into settings by the renderer via `settings:set` |
| `expand(paths)` | `files:expand` | `string[]` → `{ files: string[]; skipped: number; capped: boolean }` | Directories expand recursively, skipping hidden entries and symlinked dirs, max 1000 files |
| `reveal(path)` | `shell:reveal` | `string` → `void` | `shell.showItemInFolder` (only for paths in some job's `outputs`) |
| `openExternal(url)` | `shell:openExternal` | `string` → `void` | Only URLs equal to some `EngineInfo.installUrl` |
| `coreStatus()` | `core:getStatus` | → `{ status, restarts }` | The latest `core:status`. The renderer asks once after subscribing, because the push can arrive before it listens (first start) |
| `getSettings()` | `settings:get` | → `Settings` | |
| `setSettings(patch)` | `settings:set` | `Partial<Settings>` → `Settings` | Validate, merge, persist atomically, then relay `settings.apply` |
| `pathForFile(file)` | — (preload only) | `File` → `string` | `webUtils.getPathForFile` |
| `on(event, cb)` | — | returns `unsubscribe()` | Subscribes to the push channels below |

Push channels (main → renderer, via `webContents.send`):

| Channel | Data | Source |
|---|---|---|
| `job:update` | `Job` | Core `job.update` relayed, or synthesized by main for `CORE_CRASHED` |
| `engines:changed` | `EngineInfo[]` | Core `engines.changed` |
| `engines:installProgress` | `engine.install.progress` data | Core `engine.install.progress` |
| `core:status` | `{ status: CoreStatus; restarts: number }` | Supervisor |

The types are in [`core/src/types/ipc.ts`](../packages/core/src/types/ipc.ts).

**Path validation in main** applies to `core:detect`, `files:expand` and `job:submit`:
- The path is a string, absolute, at most 4096 characters, and contains no NUL byte.
- `fs.realpath` succeeds.
- For detect and submit inputs, it's a regular file. For `files:expand` it can be a file or a directory. For `outDir` it's a directory.
- On failure, `core:detect` gives that file `INPUT_NOT_FOUND` or `INPUT_UNREADABLE` and the rest go on. `job:submit` rejects the whole call with that error (P36: `SubmitResult` has one id per request, and the renderer detects first, so a bad path at submit is a bug and not a user condition).

## 8. Settings

The types are in [`core/src/types/settings.ts`](../packages/core/src/types/settings.ts).

| Key | Default |
|---|---|
| `output.mode` | `"source"` |
| `concurrency` | `"auto"` |
| `engines.paths` | `{}` |
| `engines.priority` | `[]`. Unlisted converters keep registration order |
| `ui.theme` | `"system"` |
| `ui.accent` | `"teal"` |
| `ui.language` | `"system"` |

Storage:
- Main owns `app.getPath("userData")/settings.json`.
- Writes are atomic: write `settings.json.tmp`, then rename. Settings are app-owned, so overwriting is fine here.
- Load: if the JSON is invalid or fails validation, rename the file to `settings.bad.json`, use the defaults and log a warning.
- Unknown keys are dropped.
- Migration: when `version` is higher than known, use the defaults and don't write until the user changes something.

## 9. Engines

The types are in [`core/src/types/engines.ts`](../packages/core/src/types/engines.ts).

`EngineInfo.error` is a code with params, never prose (ADR-16). The codes are `ENGINE_ERROR_CODES`, and the Engines page shows `translate("engine.error.<code>", params)`: `override-not-executable` (param `path`) and `version-check-failed`.

**Install rules**
- Downloads go only to `userData/engines/<engineId>/<version>/`. That location is discovered with source `"installed"`, after the override and before PATH.
- Only `https:` URLs. Redirects are followed only to `github.com`, `objects.githubusercontent.com` or `release-assets.githubusercontent.com`.
- Verify the SHA-256 **before** unpacking. Unpack with the system `tar -xf`, which ships with Windows 10+, so no new dependency.
- A failed install removes its partial dir.
- Pinned values are reviewed when the engine is bumped. They're never fetched as "latest" at run time.

## 10. Text and themes

**Rule: core never sends user-facing prose.** It sends ids, codes and params. The app turns them into text with `translate(key, params)` from `packages/app/src/locales/<locale>.json`. This keeps core language-free, so adding a language never touches core, RPC or converters.

| Key | Filled from | Example (en) |
|---|---|---|
| `format.<Format>` | `FormatInfo.id` | `format.jpg` → "JPEG image" |
| `category.<FormatCategory>` | `FormatInfo.category` | `category.image` → "Images" |
| `pack.<PackId>` | `PackId` | `pack.office` → "Office pack" |
| `lossy.<LossyId>` | `Edge.lossy`, `Route.lossy` | `lossy.layout-approx` → "layout approximate" |
| `extract.<extractorId>` | `Extractor.id` | `extract.pdfimages` → "Extract images" |
| `error.<ErrorCode>` | `CoreError.code` + `params` | `error.EMPTY_FILE` → "{name} is empty" |
| `invalid.<what>` | `params.what` of `INVALID_REQUEST` | `invalid.page-past-end` → "page {page} is past the end ({count} pages)" |
| `invalid.<option>-range` | `what` for a number option out of range: `quality`, `dpi`, `width`, `height` | `invalid.quality-range` → "quality must be a whole number from 1 to 100" |
| `invalid.<option>-value` | `what` for an option that isn't one of its allowed values: `page-size`, `tiff-compression`, `background` | `invalid.tiff-compression-value` → "unknown TIFF compression" |
| anything else | UI-only text (buttons, labels, help) | `convert.button` → "Convert" |

- Keys are flat strings. `{param}` is replaced by the param. Plurals use `<key>.one` / `<key>.other`, picked with `Intl.PluralRules`. Numbers and sizes are formatted with `Intl.NumberFormat` for the active locale.
- A missing key falls back to `en`, then to the key itself, and logs a warning once. It never throws.
- `InstallMethod` command `label`s ("Homebrew", "Debian/Ubuntu") and engine names are names, not prose, and are shown as-is.

The types are in [`core/src/types/text.ts`](../packages/core/src/types/text.ts).

**Themes.** `ui.theme` picks the mode (`system` follows `prefers-color-scheme`) and `ui.accent` the accent color. The renderer sets `<html data-theme="light|dark" data-accent="<Accent>" lang="<locale>" dir="ltr|rtl">`. Every color is a CSS variable from the theme tokens ([ARCHITECTURE section 13](ARCHITECTURE.md#13-renderer-architecture)). Theme, accent and language never reach core.
