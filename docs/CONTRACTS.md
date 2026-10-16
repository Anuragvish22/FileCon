# fileCon — Contracts

Status: draft v1 · Related: [Architecture](ARCHITECTURE.md) · [Flows](FLOWS.md) · [TRD](TRD.md) · [Index](INDEX.md)

**This file is the single source of truth** for types, messages, error codes, settings and text keys. Other docs refer to these names and never redefine them. If code and this file disagree, the code is wrong. If this file needs to change, change it and the code in the same change.

All types are JSON-serializable unless they're marked *(in-process only)*.

Each section's code block is mirrored in its own file under `core/src/types/`: 1 `domain.ts`, 2 `options.ts`, 3 `detect.ts`, 4 `jobs.ts`, 5 `errors.ts`, 6 `rpc.ts`, 7 `ipc.ts`, 8 `settings.ts`, 9 `engines.ts`, 10 `text.ts`. `types/index.ts` re-exports them all.

## 1. Domain types

```ts
type Format = string;                 // canonical lowercase id: "jpg", "pdf", "docx"
type PackId =
  | "builtin" | "office" | "media" | "docs" | "imaging" | "archive" | "ebook"
  | "3d" | "cad" | "postscript" | "ocr";
type FormatCategory =
  | "image" | "pdf" | "document" | "spreadsheet" | "presentation"
  | "audio" | "video" | "markup" | "ebook" | "3d" | "cad" | "archive"
  | "vector" | "font" | "data" | "subtitle" | "email";

interface FormatInfo {
  id: Format;                         // display name: t("format.<id>") (section 10)
  category: FormatCategory;
  exts: string[];                     // without dot, first = preferred output ext
  multiPage?: boolean;                // pdf, tiff, gif: may hold many pages/frames
}

type OptionKey = keyof ConvertOptions;
type LossyId = string;                // kebab-case, e.g. "layout-approx". Text: t("lossy.<id>")

interface Edge {
  from: Format;
  to: Format;
  cost: number;                       // scale: ARCHITECTURE section 8
  lossy?: LossyId;                    // set when quality or data is lost (section 10)
  fanOut?: boolean;                   // produces one file per page/frame
  options?: OptionKey[];              // options this edge honours
}

interface StepRequest {
  input: string;                      // absolute path (source or previous step output)
  from: Format;
  to: Format;
  outDir: string;                     // empty, job-private dir for this step
  baseName: string;                   // file stem to use, already filesystem-safe
  options: ConvertOptions;
}

// (in-process only)
interface JobCtx {
  signal: AbortSignal;
  tmpDir: string;                     // job-private root, deleted by runner
  onProgress(fraction: number | null): void;  // 0..1 for this step, null = indeterminate
  note(id: LossyId): void;            // a loss found only at run time (e.g. "downscaled"). Collected into Job.notes
}

// (in-process only)
interface Converter {
  id: string;                         // "sharp" | "pdflib" | "libreoffice" | …
  engineId: string;                   // EngineSpec id used for discovery ("builtin" engines: same as id)
  pack: PackId;
  edges: Edge[];
  timeoutMs?: number;                 // per step, default 120_000
  maxConcurrent?: number;             // default unlimited; libreoffice = 1
  available(): Promise<boolean>;
  /** Writes only inside req.outDir. Returns produced files (≥1). fanOut edges name files `page-<n>.<ext>` (n = real 1-based page) and return them in page order. */
  convert(req: StepRequest, ctx: JobCtx): Promise<string[]>;
}

// (in-process only)
interface Combiner {
  id: string;                         // "merge-pdf"
  accepts: Format;                    // every input is routed to this first
  output: Format;
  /** inputs are in user order. Writes one file inside outDir and returns its path. */
  combine(inputs: string[], outDir: string, options: ConvertOptions, ctx: JobCtx): Promise<string>;
}

// (in-process only) 1 → many files of mixed formats. Lives outside the graph, like Combiner.
interface Extractor {
  id: string;                         // "pdfimages"
  engineId: string;                   // "poppler"
  pack: PackId;
  accepts: Format;                    // "pdf". UI action text: t("extract.<id>")
  options?: OptionKey[];              // e.g. ["pages"]
  timeoutMs?: number;
  available(): Promise<boolean>;
  /** Writes only inside outDir. Returns files in page order. An empty array means nothing found (the runner maps it to NOTHING_TO_EXTRACT). */
  extract(input: string, outDir: string, options: ConvertOptions, ctx: JobCtx): Promise<string[]>;
}

interface Step { converterId: string; from: Format; to: Format }

interface Route {
  steps: Step[];                      // length 1..3
  cost: number;                       // sum of edge costs
  hops: number;                       // = steps.length
  lossy: LossyId[];                   // union of edge notes, in step order, deduped
  fanOut: boolean;                    // true if any step fans out (max one per route)
}
```

## 2. Options

```ts
interface ConvertOptions {
  quality?: number;                   // 1..100, lossy image encoders. Default 90
  dpi?: number;                       // 72..600, rasterizing (pdf→image). Default 150
  pageSize?: "auto" | "a4" | "letter"; // image→pdf. "auto" = page fits image. Default "auto"
  pages?: string;                     // pdf input only: "1-3,7,10-" (1-based). Empty/absent = all pages
}
```

- Validation happens in core at `submit`. Out-of-range values fail with `INVALID_REQUEST`, never silently clamped.
- A converter ignores keys that aren't in its edge's `options` list.
- **`pages` grammar:** a comma-separated list of `N`, `N-M`, `N-` (to the end) or `-M` (from page 1). Spaces are ignored. Numbers are ≥ 1 and `N ≤ M`. The result is normalized to sorted, merged ranges.
  - Bad syntax gives `INVALID_REQUEST` at `submit`.
  - Pages past the end are checked at run time against the real page count, and give `INVALID_REQUEST` with params `{ what: "page-past-end", page: 9, count: 5 }`.
  - Output files are named by the **real page number** (`page-003`), not by their position in the list.
- The UI shows an option only if some step of the chosen route lists it.
- shortcut: this is a fixed set with no per-converter schema. Upgrade to a declared schema per edge when the ffmpeg codec and bitrate options arrive (M1.1).

## 3. Detection and planning

```ts
interface DetectResult {
  path: string;
  size: number;                       // bytes
  format: Format | null;              // what core will treat it as; null = unsupported
  byContent: Format | null;
  byExt: Format | null;
  mismatch: boolean;                  // content and extension disagree (aliases ignored)
  error?: CoreError;                  // INPUT_NOT_FOUND | INPUT_UNREADABLE | EMPTY_FILE | UNSUPPORTED_FORMAT
}

interface TargetOption {
  format: Format;
  status: "ready" | "needs-pack";
  pack?: PackId;                      // set when status = needs-pack (first missing pack on cheapest full-graph route)
  route?: Route;                      // set when ready and a single source format is given
  lossy: LossyId[];                   // union across all inputs' routes
  fanOut: boolean;                    // any input's route fans out
  options: OptionKey[];               // union of options honoured on the routes
}

interface TargetsResult {
  convert: TargetOption[];            // formats reachable from every input
  merge: { combinerId: string; output: Format; status: "ready" | "needs-pack"; pack?: PackId }[];
  extract: { extractorId: string; status: "ready" | "needs-pack"; pack?: PackId; options: OptionKey[] }[];
  // extract: extractors whose `accepts` equals every input's format (no routing)
}
```

## 4. Jobs

```ts
type JobRequest =
  | { kind: "convert"; input: string; target: Format; options: ConvertOptions; outDir?: string }
  | { kind: "merge"; inputs: string[]; combinerId: string; options: ConvertOptions; outDir?: string }
  | { kind: "extract"; input: string; extractorId: string; options: ConvertOptions; outDir?: string };
// outDir omitted = Settings.output (source folder or custom dir)

interface SubmitResult { batchId: string; jobIds: string[] }   // same order as requests

type JobState = "queued" | "running" | "done" | "failed" | "cancelled";

interface Job {
  id: string;
  batchId: string;
  kind: "convert" | "merge" | "extract";
  inputs: string[];                   // 1 for convert and extract, N for merge (user order)
  target: Format;
  state: JobState;
  progress: { unit: number; total: number; fraction: number | null };  // overall 0..1, null = indeterminate
  outputs: string[];                  // final paths; a multi-output job has 1 folder + its files
  notes: LossyId[];                   // run-time losses reported by steps via JobCtx.note, deduped, in order
  error?: CoreError;
  createdAt: number;                  // epoch ms
  startedAt?: number;
  endedAt?: number;
}
```

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

`done`, `failed` and `cancelled` are terminal. Retry means submitting a new job, which gets a new id.

## 5. Errors

```ts
interface CoreError {
  code: ErrorCode;
  params: Record<string, string | number>;  // fills the text t("error.<code>", params). No prose (section 10)
  detail?: string;                    // engine stderr tail ≤ 2 KB, or technical cause. Shown raw, never translated
  input?: string;                     // which input path this concerns
}

// Runtime list so tests can enumerate the codes. Same order as the table below.
const ERROR_CODES = [
  "INVALID_REQUEST", "INPUT_NOT_FOUND", "INPUT_UNREADABLE", "EMPTY_FILE", "UNSUPPORTED_FORMAT",
  "INPUT_ENCRYPTED", "NO_ROUTE", "ENGINE_MISSING", "ENGINE_FAILED", "ENGINE_OUTPUT_MISSING",
  "TIMEOUT", "CANCELLED", "OUTPUT_DIR_NOT_WRITABLE", "OUTPUT_WRITE_FAILED", "DISK_FULL",
  "CORE_CRASHED", "CORE_UNAVAILABLE", "NOTHING_TO_EXTRACT", "INSTALL_FAILED", "CHECKSUM_MISMATCH",
] as const;
type ErrorCode = (typeof ERROR_CODES)[number];
```

- Params use these names only: `name` (file name, no directories), `engine`, `pack`, `from`, `to`, `dir`, `what`. `what` is an id, not prose: its text is `t("invalid.<what>")`, plus any extra numeric params it needs (`page-past-end` adds `page` and `count`).
- Logs write `code` and `params`, never translated text.
- The English column below is the source for `en.json` key `error.<CODE>`. The app owns that text, core never sends it.

| Code | Raised when | English text (`en.json` `error.<CODE>`) | Retryable |
|---|---|---|---|
| `INVALID_REQUEST` | Malformed params, bad option range, unknown combiner | "Invalid request". When `what` is set the UI shows `t("invalid.<what>", params)` instead | no |
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
| `OUTPUT_DIR_NOT_WRITABLE` | Checked at submit | "Can't write to {dir}" | after fix |
| `OUTPUT_WRITE_FAILED` | Commit failed, or 999 name conflicts | "Couldn't save {name}" | yes |
| `DISK_FULL` | ENOSPC anywhere | "Disk full" | after fix |
| `CORE_CRASHED` | Core host exited while the job was running (set by main) | "Converter process crashed" | yes |
| `CORE_UNAVAILABLE` | Restart budget exhausted. Every call fails fast | "Converter unavailable, restart the app" | no |
| `NOTHING_TO_EXTRACT` | Extractor found nothing (e.g. a PDF with no embedded images in the chosen pages) | "No embedded images found in {name}" | no |
| `INSTALL_FAILED` | Engine download, network or unzip failed, or the binaries weren't found afterwards | "Couldn't install {engine}" | yes |
| `CHECKSUM_MISMATCH` | Downloaded archive's SHA-256 differs from the pinned value. The file is deleted | "Download of {engine} was corrupted or tampered with" | yes |

## 6. Core RPC protocol

Main ⇄ Core host. The transport is the utilityProcess `parentPort` (structured clone of plain JSON). The Tauri port uses stdio with newline-delimited JSON, carrying the same envelopes.

```ts
type RpcMessage =
  | { t: "req"; id: number; method: RpcMethod; params: unknown }
  | { t: "res"; id: number; ok: true; result: unknown }
  | { t: "res"; id: number; ok: false; error: CoreError }
  | { t: "evt"; name: RpcEvent; data: unknown };

// The names in the tables below
type RpcMethod =
  | "init" | "detect" | "targets" | "plan" | "submit" | "cancel" | "cancelAll"
  | "engines.list" | "engines.refresh" | "engines.install" | "settings.apply" | "shutdown";
type RpcEvent = "ready" | "job.update" | "engines.changed" | "engine.install.progress" | "log";
```

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

The preload exposes `window.filecon` through `contextBridge`. Every method calls `ipcRenderer.invoke(channel, payload)`.

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

```ts
type CoreStatus = "starting" | "ready" | "restarting" | "unavailable";
```

**Path validation in main** applies to `core:detect`, `files:expand` and `job:submit`:
- The path is a string, absolute, at most 4096 characters, and contains no NUL byte.
- `fs.realpath` succeeds.
- For detect and submit inputs, it's a regular file. For `files:expand` it can be a file or a directory. For `outDir` it's a directory.
- On failure, that file gets `INPUT_NOT_FOUND` or `INPUT_UNREADABLE`, and the batch isn't rejected.

## 8. Settings

```ts
interface Settings {
  version: 1;
  output: { mode: "source" | "custom"; dir?: string };  // dir required when mode = custom
  concurrency: "auto" | number;       // number: 1..32. auto = max(1, cpus - 1)
  engines: {
    paths: Record<string, string>;    // engineId → absolute binary path (user override)
    priority: string[];               // converter ids, earlier wins equal-cost ties
  };
  ui: {
    theme: "system" | "light" | "dark";
    accent: Accent;                   // section 10
    language: "system" | Locale;      // system = navigator.language if it's a known Locale, else "en"
  };
}
```

| Key | Default |
|---|---|
| `output.mode` | `"source"` |
| `concurrency` | `"auto"` |
| `engines.paths` | `{}` |
| `engines.priority` | `[]`. Unlisted converters keep registration order |
| `ui.theme` | `"system"` |
| `ui.accent` | `"blue"` |
| `ui.language` | `"system"` |

Storage:
- Main owns `app.getPath("userData")/settings.json`.
- Writes are atomic: write `settings.json.tmp`, then rename. Settings are app-owned, so overwriting is fine here.
- Load: if the JSON is invalid or fails validation, rename the file to `settings.bad.json`, use the defaults and log a warning.
- Unknown keys are dropped.
- Migration: when `version` is higher than known, use the defaults and don't write until the user changes something.

## 9. Engines

```ts
interface EngineInfo {
  id: string;                         // "libreoffice", "ffmpeg", "sharp"
  pack: PackId;
  found: boolean;
  path?: string;                      // absent for bundled libraries
  version?: string;
  source?: "bundled" | "override" | "installed" | "path" | "known-dir";
  installUrl: string;                 // human install guide
  install?: InstallMethod;            // for the current platform, from EngineSpec.install
  error?: string;                     // e.g. override path invalid, version probe failed
}

// (in-process only) declared in core/src/engines/specs.ts
interface EngineSpec {
  id: string;
  pack: PackId;
  bundled?: boolean;                  // sharp, pdf-lib: no discovery
  bins?: { win32: string[]; darwin: string[]; linux: string[] };   // names to look up on PATH
  knownPaths?: { win32: string[]; darwin: string[]; linux: string[] }; // absolute candidates (globs allowed)
  versionArgs?: string[];             // ["--version"]
  versionPattern?: string;            // regex source, first capture = version
  installUrl: string;
  install?: { win32?: InstallMethod; darwin?: InstallMethod; linux?: InstallMethod };
  requiredBins?: string[];            // all must be found in the same dir (poppler: pdftoppm, pdfimages, pdfinfo)
}

type InstallMethod =
  | { kind: "download"; version: string; url: string; sha256: string; sizeBytes: number;
      archive: "zip"; binDir: string }          // binDir: path inside the archive holding the binaries
  | { kind: "command"; commands: { label: string; cmd: string }[] };  // shown with Copy buttons, never executed

```

**Install rules**
- Downloads go only to `userData/engines/<engineId>/<version>/`. That location is discovered with source `"installed"`, after the override and before PATH.
- Only `https:` URLs. Redirects are followed only to `github.com`, `objects.githubusercontent.com` or `release-assets.githubusercontent.com`.
- Verify the SHA-256 **before** unpacking. Unpack with the system `tar -xf`, which ships with Windows 10+, so no new dependency.
- A failed install removes its partial dir.
- Pinned values are reviewed when the engine is bumped. They're never fetched as "latest" at run time.

## 10. Text and themes

**Rule: core never sends user-facing prose.** It sends ids, codes and params. The app turns them into text with `t(key, params)` from `packages/app/src/locales/<locale>.json`. This keeps core language-free, so adding a language never touches core, RPC or converters.

| Key | Filled from | Example (en) |
|---|---|---|
| `format.<Format>` | `FormatInfo.id` | `format.jpg` → "JPEG image" |
| `category.<FormatCategory>` | `FormatInfo.category` | `category.image` → "Images" |
| `pack.<PackId>` | `PackId` | `pack.office` → "Office pack" |
| `lossy.<LossyId>` | `Edge.lossy`, `Route.lossy` | `lossy.layout-approx` → "layout approximate" |
| `extract.<extractorId>` | `Extractor.id` | `extract.pdfimages` → "Extract images" |
| `error.<ErrorCode>` | `CoreError.code` + `params` | `error.EMPTY_FILE` → "{name} is empty" |
| `invalid.<what>` | `params.what` of `INVALID_REQUEST` | `invalid.page-past-end` → "page {page} is past the end ({count} pages)" |
| anything else | UI-only text (buttons, labels, help) | `convert.button` → "Convert" |

- Keys are flat strings. `{param}` is replaced by the param. Plurals use `<key>.one` / `<key>.other`, picked with `Intl.PluralRules`. Numbers and sizes are formatted with `Intl.NumberFormat` for the active locale.
- A missing key falls back to `en`, then to the key itself, and logs a warning once. It never throws.
- `InstallMethod` command `label`s ("Homebrew", "Debian/Ubuntu") and engine names are names, not prose, and are shown as-is.

```ts
type Locale = "en";                   // add one entry per shipped locale file
type Accent = "blue" | "green" | "purple" | "orange";
```

**Themes.** `ui.theme` picks the mode (`system` follows `prefers-color-scheme`) and `ui.accent` the accent color. The renderer sets `<html data-theme="light|dark" data-accent="<Accent>" lang="<locale>" dir="ltr|rtl">`. Every color is a CSS variable from the theme tokens ([ARCHITECTURE section 13](ARCHITECTURE.md#13-renderer-architecture)). Theme, accent and language never reach core.
