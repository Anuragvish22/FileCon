# fileCon — Architecture

Status: draft v0 · Related: [PRD](PRD.md) · [TRD](TRD.md) · [UI Design](UI-DESIGN.md) · [Index](INDEX.md)

## 1. Overview

fileCon is an **orchestrator**. It detects formats, plans routes and runs jobs. The engines do the actual format work.

```
┌──────────────────────── packages/app (Electron) ────────────────────────┐
│  Renderer (React)  ──window.filecon.*──▶  Preload (contextBridge)       │
│        ▲                                        │ ipcRenderer.invoke    │
│        └──────── job:progress events ◀──────────▼                       │
│                                          Main process                   │
│                                          (validates paths, settings)    │
└──────────────────────────────────────────────┬──────────────────────────┘
                                               │ direct calls (Tauri: stdio JSON-RPC)
┌──────────────────────── packages/core (pure Node) ──────────────────────┐
│   detect ──▶ plan (graph) ──▶ JobRunner ──▶ OutputResolver             │
│                  ▲                 │                                    │
│              Registry ◀── converters/*, combiners/*                    │
└──────────────────────────────────┬─────────────────┬────────────────────┘
                     worker_threads│                 │child_process.spawn
                     sharp, pdf-lib│                 │soffice, ffmpeg, blender…
```

**Boundary rule:** `packages/core` never imports `electron`. Everything it exposes is JSON-serializable ([TRD section 8](TRD.md#8-tauri-port-path)).

## 2. Repo layout

```
fileCon/
├── packages/
│   ├── core/src/
│   │   ├── index.ts            public API: detect, plan, createRunner, listEngines
│   │   ├── types.ts            Format, Edge, Converter, Combiner, JobCtx, Route, Job
│   │   ├── detect.ts           magic bytes (file-type) → extension fallback
│   │   ├── formats.ts          canonical ids + aliases (jpeg→jpg, tif→tiff) + ext map
│   │   ├── registry.ts         register/list converters & combiners
│   │   ├── graph.ts            build graph from available edges, Dijkstra, maxHops
│   │   ├── jobs/runner.ts      queue, concurrency, state machine, cancel
│   │   ├── jobs/output.ts      output naming + atomic move
│   │   ├── jobs/spawn.ts       spawn wrapper: args array, timeout, tree-kill
│   │   ├── jobs/worker.ts      worker_thread pool for in-proc engines
│   │   ├── engines/discovery.ts the ONLY OS-specific code: find engine binaries
│   │   ├── converters/         sharp.ts, pdflib.ts, libreoffice.ts, …
│   │   └── combiners/          merge-pdf.ts
│   └── app/src/
│       ├── main/               window, ipc handlers, settings store
│       ├── preload/            contextBridge → window.filecon
│       └── renderer/           React UI (see UI-DESIGN)
├── test/fixtures/<fmt>/        golden inputs (small, license-clean)
└── docs/
```

## 3. Core interfaces

These are the source of truth. Code must match them, and any change to them updates this section in the same change.

```ts
type Format = string;            // canonical lowercase id: "jpg", "pdf", "docx"
type PackId = "builtin" | "office" | "media" | "docs" | "3d" | "cad" | "ocr";

interface Edge {
  from: Format;
  to: Format;
  cost: number;                  // 1 = lossless & fast … 10 = very lossy/slow
  lossy?: string;                // shown to user, e.g. "layout approximate"
}

interface JobCtx {
  signal: AbortSignal;           // cancel
  tmpDir: string;                // job-private, deleted by runner
  onProgress(fraction: number): void;  // 0..1 for current step
}

interface Converter {
  id: string;                    // "sharp", "libreoffice"
  pack: PackId;
  edges: Edge[];
  timeoutMs?: number;            // default 120_000
  maxConcurrent?: number;        // e.g. libreoffice = 1
  available(): Promise<boolean>; // engine present?
  convert(input: string, output: string, ctx: JobCtx): Promise<void>;
}

interface Combiner {
  id: string;                    // "merge-pdf"
  accepts: Format;               // every input is routed to this first
  output: Format;
  combine(inputs: string[], output: string, ctx: JobCtx): Promise<void>;
}

interface Step { converterId: string; from: Format; to: Format }
interface Route { steps: Step[]; cost: number; lossy: string[] }

type JobState = "queued" | "running" | "done" | "failed" | "cancelled";
interface Job {
  id: string;
  inputs: string[];              // 1 for convert, N for combine
  target: Format;
  combinerId?: string;
  state: JobState;
  step?: { index: number; total: number; fraction: number };
  output?: string;
  error?: string;
}
```

## 4. Data flow

1. **Detect.** `detect(path)` returns `{ format, byContent, byExt, mismatch }`.
   - It reads the first 4100 bytes and runs `file-type`.
   - If there's no match (text formats such as md, csv, svg, dxf, obj), it falls back to the extension through `formats.ts`.
   - ZIP-based containers (docx, xlsx, pptx, odt) can't be told apart by magic bytes alone, so the extension decides between them.
2. **Plan.** `plan(from, to)` returns `Route | null`.
   - It builds the graph from converters whose `available()` is true. That result is cached and refreshed when engines change.
   - It runs Dijkstra on `cost`, capped at **3 hops**. An equal cost goes to the route whose converters rank higher in user priority.
   - `lossy` is the union of each step's notes.
   - `targets(froms[])` gives the intersection of formats reachable from every input, which feeds the UI target picker.
3. **Submit.** The runner creates a `Job` and queues it.
4. **Run.** Each step writes to `tmpDir/step-<i>.<ext>`, and the next step reads that file.
5. **Finish.** The last file is moved atomically to the output path ([section 6](#6-job-runner)), then the temp dir is removed.

## 5. Merge (N to 1)

Merges are kept outside the graph, because N-to-1 doesn't fit the edge model.

```
inputs[i] ──plan(fmt_i → combiner.accepts)──▶ tmp/part-i.pdf ─┐
                                                            ├─▶ combiner.combine() ─▶ output.pdf
inputs[j] ──(already pdf: no-op)──────────────────────────────┘
```

- Input order is the order the user set in the UI.
- If any input has no route, the job fails before running anything, and the error names that input.
- v1 has one combiner, `merge-pdf` (pdf-lib). A later candidate is `zip` (archive).

## 6. Job runner

**State machine:** `queued → running → done | failed | cancelled`. Every terminal state cleans up.

- **Temp dir:** `os.tmpdir()/filecon-<jobId>/`. On startup, the runner sweeps `filecon-*` dirs older than 24 h that were left by crashes.
- **Concurrency:** a global limit of `cpus - 1`, plus a per-converter `maxConcurrent` limit. LibreOffice is limited to 1, and each call gets `-env:UserInstallation=file://<tmpDir>/lo-profile` so its profile can't lock.
- **External engines** (`jobs/spawn.ts`):
  - `spawn(bin, args[], { shell: false })`
  - kill on `signal` abort or when `timeoutMs` passes
  - kill the whole process tree (`taskkill /T /F` on Windows, process group kill on POSIX)
  - capture stderr, and keep its last 2 KB as the failure reason
- **In-process engines** (sharp, pdf-lib) run in a `worker_threads` pool, so main never blocks. Cancelling terminates the worker.
- **Output** (`jobs/output.ts`):
  - The default target folder is the source's folder, or the user can choose one.
  - The name is `<stem>.<ext>`, or `<stem> (n).<ext>` when that exists.
  - The file is written in temp, then moved with `fs.rename`, or copy+unlink across devices.
  - **The runner never opens a source file for writing.**
- **Batch:** each file is its own job. A failure only affects its own job.

## 7. Engine discovery and packs

The order for each engine:
1. The user override from settings
2. `PATH` (`which`/`where`)
3. Known install dirs per OS ([TRD section 4](TRD.md#4-engine-matrix))

- After that, a version probe (`--version`) is cached per path.
- `listEngines()` returns `{ id, pack, found, path?, version?, installUrl }[]` for the Engines page.
- If a pack is missing, its converters are left out of the graph. The UI can still show "needs X pack" targets by running `plan` against the **full** graph with an `includeUnavailable` flag.
- M3 one-click downloads go to `app.getPath('userData')/engines/<id>/` and are verified against a pinned SHA-256.

## 8. IPC contract

The preload exposes `window.filecon`. Every call goes through `ipcRenderer.invoke` to a main handler, and main validates every path ([TRD NFR-8](TRD.md#3-non-functional-requirements)).

| Channel | Direction | Request | Response |
|---|---|---|---|
| `core:detect` | R → M | `{ paths: string[] }` | `DetectResult[]` |
| `core:targets` | R → M | `{ formats: Format[] }` | `{ format, route?, needsPack?, lossy[] }[]` |
| `job:submit` | R → M | `{ inputs, target, combinerId?, outDir? }` | `{ jobId }` |
| `job:cancel` | R → M | `{ jobId }` | `void` |
| `job:progress` | M → R (event) | — | `Job` snapshot (throttled to about 10/s) |
| `engines:list` | R → M | — | `EngineInfo[]` |
| `settings:get` / `settings:set` | R → M | `Partial<Settings>` | `Settings` |
| `shell:reveal` | R → M | `{ path }` | `void` (shows the file in its folder) |

The renderer gets file paths only from drag-drop (`webUtils.getPathForFile`) or the native open dialog.

## 9. Extensibility

To add a converter:
1. Create `packages/core/src/converters/<id>.ts` that implements `Converter` ([section 3](#3-core-interfaces)).
2. Declare `edges` with honest `cost` and `lossy` notes, and set `pack` and `timeoutMs`.
3. Implement `available()` through `engines/discovery.ts`, and `convert()` through `jobs/spawn.ts` or the worker pool.
4. Register it in `registry.ts`. Add fixtures and a golden test ([TRD section 6](TRD.md#6-testing-strategy)). Add a license row to [TRD section 4](TRD.md#4-engine-matrix).

Adding a combiner works the same way: implement `Combiner` and register it.

## 10. ADR log

| # | Decision | Why | Alternatives rejected |
|---|---|---|---|
| ADR-1 | Electron + React/TS | Node-native engines (sharp), one language, fastest path to learn | Tauri: smaller, but needs Rust and has no sharp. It's the planned port target ([TRD section 8](TRD.md#8-tauri-port-path)) |
| ADR-2 | A graph of edges with Dijkstra routing | One new engine unlocks many paths | A hard-coded pair table, which explodes combinatorially |
| ADR-3 | Max 3 hops | Prevents absurd, quality-killing chains | Unbounded routing |
| ADR-4 | Combiners kept separate from the graph | N-to-1 doesn't fit the edge model, and this reuses the graph per input | A special "merge" node in the graph |
| ADR-5 | Golden tests check that output parses, not hashes | Engine upgrades change bytes but not validity | Byte hashes, which give flaky tests |
| ADR-6 | Engines as optional packs, not bundled | Keeps the base installer small and avoids license problems | Bundle everything (over 1 GB, license risk) |
| ADR-7 | Magic-byte detection first | Extensions lie | Extension only |
