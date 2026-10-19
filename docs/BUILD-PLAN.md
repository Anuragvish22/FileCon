# fileCon — Build Plan

Status: draft v1 · Related: [Architecture](ARCHITECTURE.md) · [Contracts](CONTRACTS.md) · [Flows](FLOWS.md) · [PRD](PRD.md) · [Index](INDEX.md)

Tasks are in dependency order, so do them top to bottom. Each task is one reviewable change (one PR or commit series).

A task is **done** only when:
- `pnpm typecheck`, `pnpm lint` and `pnpm test` are green
- its tests exist and pass: both the **Happy path** list and the **Must also pass** list
- the docs it touches are updated
- the INDEX links are still valid

Happy path proves the feature works for normal input. Must also pass covers edge cases, errors, cancel and timeout, cleanup and the hard rules in CLAUDE.md. A task with only happy-path tests is not done. Converters and extractors also pass the shared must-pass set ([TRD section 6](TRD.md#6-testing-strategy)).

Status legend: ☐ todo · ◐ in progress · ☑ done. Update the marker in this file as part of the task.

A **Parked to review first** line points at [PARKED](PARKED.md) items to decide with the user before the task starts.

## 1. M0 — Core logic

Goal: the pure logic of `@filecon/core` is built and tested, with no engines, no Electron and no UI.

### M0-1 Workspace scaffold ☑
- **Files:**
  - root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `vitest.config.ts` (with `test.projects`)
  - `packages/core/{package.json,tsconfig.json,src/index.ts}`
  - `packages/app/package.json`, as a placeholder
- **Details:**
  - TS `strict`, ESM, Node 22 target.
  - ESLint with typescript-eslint, eslint-plugin-import-x (`import-x/no-cycle`), and `no-restricted-imports: electron` in core.
  - Root scripts: `dev`, `test`, `typecheck`, `lint`, `build`, `docs:check`.
- **Tests:**
  - Happy path:
    - a smoke test in core (`expect(true)`)
    - `docs:check` passes. That script is the anchor-link checker from the docs work, moved to `scripts/check-docs.mjs`.
  - Must also pass:
    - `docs:check` fails on a broken anchor link
    - a core file importing `electron` fails lint
- **Done when:** all scripts run green on a clean clone, and `pnpm --filter @filecon/core test` works.

### M0-2 Types, errors, formats ☑
- **Depends on:** M0-1
- **Files:** `core/src/types/` (copy of [CONTRACTS](CONTRACTS.md), verbatim, one file per section), `core/src/errors.ts`, `core/src/formats.ts`
- **Details:** `types/errors.ts` includes the `ERROR_CODES` array. `errors.ts` has a `coreError(code, params, detail?)` factory, and `CoreFailure`, the Error subclass core throws (its plain `.error` is what crosses RPC), that builds a [CONTRACTS section 5](CONTRACTS.md#5-errors) `CoreError` with **no prose**: the text lives in the app ([CONTRACTS section 10](CONTRACTS.md#10-text-and-themes)). `formats.ts` holds the [ARCHITECTURE section 6](ARCHITECTURE.md#6-format-registry) table, with no display labels.
- **Tests:**
  - Happy path:
    - `formats.test.ts`: alias → canonical, first ext = output ext
    - `errors.test.ts`: `coreError("EMPTY_FILE", { name: "a.png" })` gives that code and params
  - Must also pass:
    - ext lookup is case-insensitive, unknown → null
    - `ERROR_CODES` matches the [CONTRACTS section 5](CONTRACTS.md#5-errors) table exactly, both ways (test parses the table)
    - a `CoreError` survives `JSON.parse(JSON.stringify(error))` unchanged, and `params` keys are only the allowed names
    - `CoreFailure` is an `Error` with a stack, and its `.error` survives `structuredClone` unchanged

### M0-3 Registry ☑
- **Depends on:** M0-2
- **Files:** `core/src/registry.ts`, `core/test/registry.test.ts`
- **Tests:**
  - Happy path: `converters()` keeps registration order.
  - Must also pass:
    - duplicate id throws
    - an unknown id lookup returns undefined

### M0-4 Graph and routing ☑
- **Depends on:** M0-3
- **Files:** `core/src/graph/{build,route,targets,index}.ts`, `core/src/costs.ts`, `core/test/fakes.ts` (fake converters and combiners, `fullGraphOf`), `core/test/graph/{route,targets}.test.ts`
- **Details:** [ARCHITECTURE section 8](ARCHITECTURE.md#8-routing-algorithm).
- **Tests** in `graph/route.test.ts` and `graph/targets.test.ts`:
  - Happy path:
    - direct route
    - a 2-hop route beating an expensive 1-hop one
    - `targets`: intersection, merge eligibility, `lossy`/`options` union
  - Must also pass:
    - a 4-hop route returning null
    - a cheaper route with more hops being found (the case capped Dijkstra gets wrong)
    - tie → fewer hops → priority
    - a self-edge is offered only as the 1-step route `route(graph, format, format)`, never inside a multi-hop route; without one it is null
    - at most one fan-out, and a dearer route that saves its one fan-out is still found
    - no cycles
    - `targets` offers the input's own format only when it has a self-edge (mixed inputs: only if every input reaches it), and `needs-pack` comes from the full graph
    - the cache being cleared on rebuild

### M0-5 Detection ☑
- **Depends on:** M0-2
- **Files:** `core/src/detect.ts`, `test/fixtures/{jpg,png,webp,pdf,docx,doc,txt-renamed}/…`
- **Details:** [ARCHITECTURE section 7](ARCHITECTURE.md#7-detection-algorithm). Adds dependency `file-type`, which needs an ask.
- **Tests:**
  - Happy path: a correct match, docx by zip + ext, doc by CFB + ext, svg sniff.
  - Must also pass:
    - a `.jpg` that's really webp (`mismatch`)
    - a CFB with the wrong ext → unsupported
    - empty file → `EMPTY_FILE`, missing file → `INPUT_NOT_FOUND`, a directory → `INPUT_UNREADABLE`
    - an unreadable file (EACCES) → `INPUT_UNREADABLE`
    - a symlink to a file is followed
    - a no-ext binary

### M0-6 Output commit ☑
- **Depends on:** M0-2
- **Files:** `core/src/jobs/output.ts`, `core/src/jobs/tmp.ts`
- **Details:** [ARCHITECTURE section 10](ARCHITECTURE.md#10-output-commit). The `fs` functions used are injectable, so EXDEV and EPERM can be simulated.
- **Tests:** real tmp dirs.
  - Happy path:
    - no conflict
    - conflict → `(1)`, `(2)`
    - `commitFolder` naming and padding
  - Must also pass:
    - **two concurrent commits of the same stem get distinct names**
    - source-is-destination case
    - the source's bytes, mtime and size are unchanged after every commit
    - EXDEV fallback
    - FAT-like fallback (link → EPERM)
    - ENOSPC → `DISK_FULL`
    - `safeStem`: `a:b?` → `a_b_`, trailing dots and spaces trimmed, `CON`/`con.txt`/`COM1` get `_`, a 300-byte name (also multi-byte, e.g. Hindi or emoji) is cut to ≤ 200 bytes without breaking a character, empty → `file`
    - 999 limit → `OUTPUT_WRITE_FAILED`
    - a 1,800-page folder: width 4, in order
    - a failure midway removes what the commit created and keeps the temp files
    - `sweep` removes only old `filecon-*` dirs

**M0 exit** ☑: the core logic is covered by unit tests, and coverage of `graph`, `detect` and `output` is at least 90% of lines. Checked by `pnpm test:coverage`, which fails under 90% (98.5% at M0-6).

## 2. M1 — MVP

Goal: PRD F1–F8 work end to end in the app on all three OSes.

### M1-1 Safe spawn ☑
- **Depends on:** M0-2
- **Files:** `core/src/jobs/spawn.ts`
- **Details:**
  - `shell: false` always. POSIX uses `detached: true` and kills the process group with `process.kill(-pid)`. Windows uses `taskkill /PID <pid> /T /F`.
  - It keeps the last 2 KB of stderr.
  - It resolves `{ code, stdoutTail, stderrTail }` and rejects with a `CoreError` (`ENGINE_FAILED`, `TIMEOUT`, `CANCELLED`). The signature is one object, `run({ bin, args, signal, timeoutMs, cwd?, onStdout? })`.
- **Tests:** spawn `process.execPath` with `-e` scripts:
  - Happy path: exit 0 resolves with the stdout and stderr tails.
  - Must also pass:
    - exit 1 → `ENGINE_FAILED`
    - a stderr flood truncated to 2 KB
    - timeout → `TIMEOUT`
    - abort → `CANCELLED`
    - **abort kills a grandchild** (the script spawns a child that sleeps)
    - argument with spaces and quotes passed through intact
    - an argument with shell metacharacters (`; rm -rf x`, `$(id)`, `` `id` ``, `&&`) arrives as one literal string
    - a string command or `shell: true` does not type-check (a `@ts-expect-error` test)

### M1-2 Scheduler and runner ☑
- **Depends on:** M0-4, M0-6, M1-1
- **Files:** `core/src/jobs/scheduler.ts`, `core/src/jobs/runner.ts`, `core/src/errors.ts` (`toCoreError`)
- **Details:** [ARCHITECTURE section 9](ARCHITECTURE.md#9-job-runner) and [FLOWS F4 to F9](FLOWS.md#f4-single-convert). Updates are throttled to 10/s, and state changes are emitted immediately. `toCoreError(caught: unknown): CoreError` turns anything caught into the plain error a `Job` carries: a `CoreFailure` gives its `.error`, `ENOSPC` gives `DISK_FULL`, and anything else keeps its message and stack in `detail` (pick its code in this task).
- **Tests:** with fakes:
  - Happy path:
    - update sequence for one job
    - FIFO order
    - fan-out mapping
    - merge order
  - Must also pass:
    - slot limit, semaphore = 1, `setConcurrency`
    - merge with one failing input
    - cancel while queued, while running, after done
    - timeout
    - `ENGINE_OUTPUT_MISSING`
    - a converter writing outside `outDir` → failure
    - temp dir removed in every terminal state
    - the source is untouched in every terminal state
    - overall `fraction` never decreases, even when a step reports a lower value
    - `ctx.note` ids end up in `Job.notes`, deduped and in order
    - `toCoreError`: one test per branch (CoreFailure, ENOSPC, a plain Error, a non-Error value)

### M1-3 Engine discovery ☑
- **Depends on:** M0-2
- **Files:** `core/src/engines/specs.ts` (sharp, pdf-lib, libreoffice), `core/src/engines/discovery.ts`
- **Details:** [ARCHITECTURE section 11](ARCHITECTURE.md#11-engine-discovery).
- **Tests:** injected dependencies:
  - Happy path:
    - bundled
    - override valid
    - PATH hit
    - version parse
  - Must also pass:
    - override invalid (no fall-through)
    - an override pointing to a directory → not found, with an error
    - win32 PATHEXT
    - known-path glob
    - WSL `/mnt/c` skipped
    - version probe failure → found with an error

### M1-4 Converters and combiner ☑
Split into three changes (a, b, c) at M1-4, because it was too much for one. Tick this heading when all three are ☑. Tasks that depend on M1-4 need all three.
- **Depends on:** M1-1, M1-3
- **Dependencies to add (approved):** `sharp` (with 4a), `pdf-lib` (with 4b).

#### M1-4a Sharp converter and the contract helper ☑
- **Files:** `core/src/converters/sharp.ts`, `core/src/options.ts` (`validateOptions`), `core/test/contract.ts` (`runConverterContract`), `core/test/harness.ts` (shared runner harness, moved out of `runner.test.ts`)
- **Details:** jpg, png, webp, avif, tiff and gif between each other, with `quality`.
  - Self-edges jpg → jpg, webp → webp and avif → avif (cost 3, `quality`, lossy `reencoded`). Self-edges png → png, tiff → tiff and gif → gif at cost 2, no `lossy` id (for resize and grayscale).
  - Scales down to the target's size limit with `ctx.note("downscaled")` ([ARCHITECTURE section 8](ARCHITECTURE.md#8-routing-algorithm)).
  - Every sharp edge also takes `width`, `height`, `grayscale` and `keepMetadata`, and → tiff edges take `tiffCompression` ([CONTRACTS section 2](CONTRACTS.md#2-options)). Always turns the image upright from EXIF first.
- **Tests:** golden tests, which assert parse results only:
  - Happy path: output `file-type` and dimensions equal the input's, for every pair.
  - Must also pass:
    - the converter calls `runConverterContract` ([TRD section 6](TRD.md#6-testing-strategy))
    - a corrupt fixture → `ENGINE_FAILED`, temp dir removed
    - sharp `quality` out of range → `INVALID_REQUEST`
    - a 20,000 × 10 png → webp comes out ≤ 16,383 px wide with `Job.notes` = `["downscaled"]`; a normal one has no notes
    - jpg → jpg at quality 40 gives a valid, smaller jpg named `<stem> (1).jpg`
    - 400×200 at `width` 100 → 100×50; `width` 1000 on a 400 px image stays 400; `width` 0 → `INVALID_REQUEST`
    - `grayscale` output has 1 channel (or is `b-w`)
    - GPS survives only with `keepMetadata`; an EXIF-rotated fixture comes out upright with metadata stripped
    - each `tiffCompression` value gives that compression

#### M1-4b Image to PDF and merge ☑
- **Depends on:** M1-4a
- **Files:** `converters/pdflib.ts`, `combiners/merge-pdf.ts`; adds `pdf-lib`
- **Details:** `pdflib`: jpg and png → pdf at cost 1, with `pageSize`. Other images first route through sharp → png. `merge-pdf` combines PDFs in the user's order.
- **Tests:** golden tests, which assert parse results only:
  - Happy path:
    - pdflib: page count = 1, page size per option
    - merge: page count = sum, order checked via distinct page sizes
  - Must also pass:
    - the converter and the combiner call `runConverterContract` ([TRD section 6](TRD.md#6-testing-strategy)); extend the helper for combiners
    - a corrupt fixture → `ENGINE_FAILED`, temp dir removed

#### M1-4c LibreOffice converter ☑
- **Depends on:** M1-4a
- **Files:** `converters/libreoffice.ts`
- **Details:** office formats → pdf at cost 5, `maxConcurrent: 1`, timeout 180 s, with a persistent profile per slot in `<dataDir>/lo-profile-<slot>/`, deleted after a failed run ([ARCHITECTURE section 8](ARCHITECTURE.md#8-routing-algorithm)). Document the font limit decided at M1-4 (P9): a document in a script the machine has no font for renders as boxes; detection stays parked ([P9](PARKED.md#2-items)).
- **Tests:**
  - Happy path: `skipIf(!available)`, `file-type` = pdf, pages ≥ 1
  - Must also pass:
    - the converter calls `runConverterContract`
    - a corrupt fixture → `ENGINE_FAILED`, temp dir removed
    - two jobs in a row reuse the profile dir; after a failed run the dir is gone and the next job still succeeds

### M1-5 RPC server and core host ☐
- **Parked to review first:** [P10 types vs CONTRACTS check](PARKED.md#2-items)
- **Depends on:** M1-2, M1-3, M1-4
- **Files:** `core/src/rpc/protocol.ts`, `core/src/rpc/server.ts`, `core/src/host.ts`
- **Details:** [CONTRACTS section 6](CONTRACTS.md#6-core-rpc-protocol).
- **Tests:** a server over a `MessageChannel`, using the real modules with fake converters:
  - Happy path:
    - every method's happy path
    - events relayed
  - Must also pass:
    - `CORE_UNAVAILABLE` before `ready`
    - unknown method → `INVALID_REQUEST`
    - malformed params → `INVALID_REQUEST`
    - `submit` all-or-nothing validation
    - `shutdown` cancels running jobs and cleans up

### M1-6 App main and preload ☐
- **Depends on:** M1-5
- **Files:** `app/src/main/{index,supervisor,coreClient,ipc,paths,settings,log}.ts`, `app/src/preload/index.ts`, electron-vite config
- **Details:** [ARCHITECTURE section 12](ARCHITECTURE.md#12-core-host-and-supervision) and [CONTRACTS section 7 and section 8](CONTRACTS.md#7-ipc-renderer--main).
  - `webPreferences`: `contextIsolation`, `sandbox`, no `nodeIntegration`.
  - CSP: `default-src 'self'`.
  - Navigation and new windows are blocked.
  - `shared/i18n.ts` (`t()`) and `locales/en.json` land here, because main's install-confirm dialog uses them ([CONTRACTS section 10](CONTRACTS.md#10-text-and-themes)).
  - Settings validation covers `ui.accent` and `ui.language`.
- **Dependencies to add (ask):** `electron`, `electron-vite`.
- **Tests:**
  - Happy path:
    - `supervisor.test.ts`: fake fork reaches ready
    - `coreClient.test.ts`: id matching
    - `paths.test.ts`: a valid file path is accepted
    - `settings.test.ts`: load and save round-trip
    - `i18n.test.ts`: `{param}` substitution, `.one` / `.other` plurals
  - Must also pass:
    - supervisor: ready timeout, crash and restart, budget exhaustion, synthesized `CORE_CRASHED` updates
    - coreClient: timeouts, out-of-order responses
    - paths: a relative path, a path with `..`, and a non-string are refused
    - settings: invalid values rejected (including an unknown accent or locale), a corrupt settings file recovers to defaults
    - i18n: a missing key falls back to `en`, then to the key, warns once and never throws; a missing param leaves `{param}` visible
    - tooling test `test/tooling/i18n-keys.test.ts`: every key core can emit exists in `en.json`: `error.<code>` for all `ERROR_CODES`, `format.<id>` and `category.<c>` from `formats.ts`, `pack.<id>`, every converter's `lossy` id, every extractor id, every `invalid.<what>` core raises
    - preload exposes only `window.filecon`; `webPreferences` has `contextIsolation`, `sandbox` and no `nodeIntegration`

### M1-7 Renderer ☐
- **Parked to review first:** [P9 fonts in office → pdf](PARKED.md#2-items), [P20 page placement for image → pdf](PARKED.md#2-items), [P25 two sharp choices](PARKED.md#2-items), [P26 very large documents and the 180 s timeout](PARKED.md#2-items)
- **Depends on:** M1-6
- **Files:** `app/src/renderer/{store,components,pages}/…`
- **Details:** [ARCHITECTURE section 13](ARCHITECTURE.md#13-renderer-architecture) and [UI-DESIGN](UI-DESIGN.md). Build order: theme tokens → store and selectors → DropZone and FileList → TargetPicker and OptionsBar → JobsPanel → EnginesPage → SettingsPage (with theme, accent, language).
  - All text through `t()`, all colors through theme tokens, CSS logical properties only ([CONTRACTS section 10](CONTRACTS.md#10-text-and-themes)).
- **Dependencies to add (ask):** `react`, `react-dom`, `@testing-library/react`, `eslint-plugin-react` (for `react/jsx-no-literals`).
- **Tests:**
  - Happy path: `reducer.test.ts` and `selectors.test.ts` (pure) for add files → pick target → job done.
  - Must also pass:
    - TargetPicker keyboard navigation
    - JobsPanel live-region text
    - empty state (no files) and failed-job state render
    - a 🔒 target can't be submitted
    - `tokens.test.ts`: text, muted text and accent-on-background meet 4.5:1 for every accent × mode
    - changing theme, accent or language updates `<html>` (`data-theme`, `data-accent`, `lang`, `dir`) and the visible text without a reload
    - a JSX literal string in a component fails lint

### M1-8 CI matrix ☐
- **Parked to review first:** [P19 find LibreOffice on any Windows drive](PARKED.md#2-items), [P22 pdf-lib is unmaintained](PARKED.md#2-items), [P23 field-level metadata check](PARKED.md#2-items), [P24 sharp on Windows and macOS](PARKED.md#2-items), [P27 LibreOffice converter on Windows and macOS](PARKED.md#2-items)
- **Depends on:** M1-7
- **Files:** `.github/workflows/ci.yml`
- **Details:** ubuntu, windows and macos, with Node 22 and pnpm: lint, typecheck, test, `docs:check`. LibreOffice is installed on ubuntu only, so that its golden tests run there. Installers come in M1.2 ([TRD section 7](TRD.md#7-build-and-release)).

**M1 exit:**
- Every PRD F1–F8 acceptance criterion passes ([PRD section 5](PRD.md#5-features-by-milestone)).
- CI is green on 3 OSes.
- The manual smoke checklist (below) passes on Windows and on Linux (WSLg).

## 3. M1 smoke checklist

- [ ] Drop 3 jpgs, convert to png, and the outputs sit next to the sources.
- [ ] Convert again: the outputs are named `(1)`, and the originals are untouched (same mtime and size).
- [ ] A `.jpg` that's really webp shows the mismatch badge and converts correctly.
- [ ] docx → pdf works with LibreOffice installed. Without it, the target shows 🔒 and the Set path flow works.
- [ ] Merge 2 images and 1 docx in a custom order: the PDF pages follow that order.
- [ ] Cancel a running docx → pdf: within 2 s there's no `soffice` process, no temp dir and no output.
- [ ] Batch 20 mixed files: the UI stays responsive, and one corrupt file fails alone.
- [ ] Kill the core host from the OS task manager: the banner shows restarting, jobs show failed, and new jobs work after the restart.
- [ ] Quit during a batch: no orphan engine processes, and no `filecon-*` temp dirs.

## 4. M1.1 — PDF to images

Goal: PRD F9, F21, F22, F34 and F35 work. You can render PDF pages to images, extract embedded images, pick or split PDF pages, stitch pages into one long image, and install Poppler in one click on Windows. Design: [ARCH section 8](ARCHITECTURE.md#8-routing-algorithm) (PDF edges), [ARCH section 9](ARCHITECTURE.md#9-job-runner) (extract job), [ARCH section 11](ARCHITECTURE.md#11-engine-discovery) (install assistant), [FLOWS F14](FLOWS.md#f14-pdf-pages-to-images) to [F16](FLOWS.md#f16-install-an-engine).

### M1.1-1 Page range parser ☐
- **Depends on:** M0-2
- **Files:** `core/src/pages.ts`. Add `pages` to `ConvertOptions` validation in `submit`.
- **Tests** in `pages.test.ts`:
  - Happy path: `"1-3,7"`, `" 2 , 4-5 "`, `"5-"`, `"-4"` (pages 1 to 4)
  - Must also pass:
    - overlapping and unsorted input merged (`"3,1-2"` → `1-3`)
    - rejects `"0"`, `"3-1"`, `"a"`, `"1--2"`, `"-"`, `"-0"`, `""`
    - `boundPages` past the end gives `what: "page-past-end"` with the right `page` and `count`
    - an open end (`5-`) bounded to the count

### M1.1-2 Poppler engine and render edges ☐
- **Parked to review first:** [P21 real encrypted-PDF detection](PARKED.md#2-items)
- **Depends on:** M1.1-1, M1-3, M1-4
- **Files:** `engines/specs.ts` (poppler spec with `requiredBins`, `install` pins), `converters/poppler.ts`, `test/fixtures/pdf/{3-pages.pdf,encrypted.pdf}`
- **Also here:** the `requiredBins` check in `engines/discovery.ts` ([ARCH section 11](ARCHITECTURE.md#11-engine-discovery) step 7: every bin in the same dir as the first hit, else "incomplete install (missing pdfimages)"), with its test. M1-3 left it out.
- **Details:** `pdfinfo` parsing (`Pages:`, `Encrypted:`), one `pdftoppm` per range, `-progress` parsing, and renaming `p-<page>` → `page-<page>`.
- **Tests:**
  - Happy path:
    - `pdfinfo` output parser, with sample text, run without the engine
    - golden, engine-gated: 3 pages at dpi 72 → 3 png files, width = page width (pt) × 72/72
    - golden, engine-gated: `pages: "2"` → only `page-002`
  - Must also pass:
    - discovery `requiredBins`: one bin missing → `found = false`
    - `runConverterContract` ([TRD section 6](TRD.md#6-testing-strategy)), engine-gated
    - jpg quality applied (the file at q=30 is smaller than at q=95)
    - encrypted fixture → `INPUT_ENCRYPTED`
    - `pages` past the end → `INVALID_REQUEST` with `what: "page-past-end"`
    - cancel mid-render leaves no `page-*` files in the destination

### M1.1-3 Extractor kind and pdfimages ☐
- **Depends on:** M1.1-2, M1-2
- **Files:** `registry.ts` (extractors), `graph/targets.ts` (`targets().extract`), `jobs/runner.ts` (extract kind), `extractors/pdfimages.ts`, `test/fixtures/pdf/{two-jpegs.pdf,text-only.pdf}`. The source JPEGs are kept next to the fixture for comparison.
- **Tests:**
  - Happy path:
    - runner with a fake extractor produces its files
    - golden, engine-gated: `two-jpegs.pdf` → 2 files **byte-identical** to the sources, named `page-001-01.jpg`, `page-001-02.jpg`
  - Must also pass:
    - fake extractor: `[]` → `NOTHING_TO_EXTRACT`, a file outside `outDir` → failure
    - `targets` lists the extractor only when every input is pdf
    - `runConverterContract` ([TRD section 6](TRD.md#6-testing-strategy)), engine-gated
    - `text-only.pdf` → `NOTHING_TO_EXTRACT`
    - encrypted fixture → `INPUT_ENCRYPTED`
    - a page range limits the output

### M1.1-4 Install assistant ☐
- **Depends on:** M1.1-2, M1-5
- **Also here:** the "installed" step in `engines/discovery.ts` ([ARCH section 11](ARCHITECTURE.md#11-engine-discovery) step 3: the newest `<dataDir>/engines/<id>/<version>/<binDir>`, source `installed`). M1-3 left it out.
- **Files:** `engines/install.ts`, `rpc/server.ts` (`engines.install`, `engine.install.progress`), app `ipc.ts` (`engines:install` with confirm dialog), preload `installEngine`.
- **Details:** [ARCH section 11](ARCHITECTURE.md#11-engine-discovery).
  - Download the pinned release zip once by hand and confirm the `binDir` inside it. Fix the pin table if it differs.
  - Unpack with `tar -xf`.
  - Only the allowed redirect hosts.
- **Tests** in `install.test.ts`, with a local HTTPS server and a self-signed cert injected via deps:
  - Happy path: a zip fixture with fake `pdftoppm`/`pdfimages`/`pdfinfo` scripts → `found`, source `installed`
  - Must also pass:
    - checksum mismatch → `CHECKSUM_MISMATCH`, file deleted
    - redirect to a non-allowed host refused
    - truncated download → `INSTALL_FAILED`
    - zip missing a bin → `INSTALL_FAILED`
    - a concurrent second call shares the first
    - cleanup after every failure
    - `engines.install` on a command-kind spec → `INVALID_REQUEST`

### M1.1-5 UI for PDFs and install ☐
- **Depends on:** M1.1-3, M1.1-4, M1-7
- **Files:** renderer `OptionsBar` (Pages, DPI), `ExtractButton`, `InstallDialog`, EnginesPage install actions, store slice for install progress.
- **Tests:**
  - Happy path:
    - selectors: Extract is visible when all rows are PDF
    - `InstallDialog` progress → done, for both method kinds
  - Must also pass:
    - selectors: Extract hidden when any row isn't PDF; pages validation message; invalid pages disables Convert
    - `InstallDialog` failure state, with keyboard and live-region checks

**M1.1 PDF exit:**
- Smoke checks below pass on Windows (download install) and Linux (apt install, then Re-check).
  - [ ] Render pages `2-3` of a 5-page PDF at 150 dpi → `report (png)/page-002.png`, `page-003.png`.
  - [ ] Extract from a PDF with photos → originals open fine. A text-only PDF shows "No embedded images found".
  - [ ] Windows without Poppler: the 🔒 target → Install → progress → the target unlocks with no restart.
  - [ ] Tamper the pinned hash in a dev build → `CHECKSUM_MISMATCH`, and nothing is left in `userData/engines/`.

### M1.1-6 PDF page selection and split ☐
- **Depends on:** M1.1-1, M1.1-3, M1-4
- **Files:** `converters/pdflib.ts` (self-edge pdf → pdf, cost 1, `pages`: keeps only those pages in one pdf), `extractors/split-pdf.ts` (accepts pdf, `folder: "pages"`, `pages`: one `page-<page>.pdf` per page), renderer "Split into pages" next to "Extract images". Engine is pdf-lib, built in.
- **Tests:**
  - Happy path:
    - `pages "2-3"` on a 5-page pdf → a 2-page pdf
    - split of a 3-page pdf → `report (pages)/page-001.pdf` … `page-003.pdf`, one page each
  - Must also pass:
    - pages past the end → `INVALID_REQUEST` with `what: "page-past-end"`
    - encrypted pdf → `INPUT_ENCRYPTED`
    - `runConverterContract` for both

### M1.1-7 One long image ☐
- **Depends on:** M1.1-2, M1-4
- **Files:** `combiners/stack-png.ts` (sharp: accepts png, output png, stacked top to bottom in input order, centred on the widest, white background; past sharp's pixel limit it scales down and calls `ctx.note("downscaled")`), `graph/targets.ts` (`targets().merge` for 1 file whose route fans out), `jobs/runner.ts` (a fanned-out merge input adds all its files in page order), renderer "One long image" toggle for target png.
- **Details:** [ARCH section 9](ARCHITECTURE.md#9-job-runner) merge job, [FLOWS F7](FLOWS.md#f7-merge-to-pdf). shortcut: output is png only, because jpg stops at 65,500 px; route onward when asked.
- **Tests:**
  - Happy path:
    - two 100×50 pngs → one 100×100
    - a 3-page pdf → height = sum of the page heights
  - Must also pass:
    - mixed widths are centred
    - over the pixel limit → downscaled, `Job.notes` = `["downscaled"]`
    - `targets` marks it `fanOut` for pdf input, not for png; the selector shows it for a single pdf, not a single png (`selectors.test.ts`)
    - `runConverterContract`

## 5. After M1

The rest of M1.1 (FFmpeg, the Engines page polish), M1.2, M2 and M3 get their own task sections here when they start. Their scope is in [PRD section 5](PRD.md#5-features-by-milestone).

The FFmpeg tasks must cover the resolution and audio bitrate options ([CONVERSIONS section 2](CONVERSIONS.md#2-phase-m11--pdf-to-images-audio-and-video)), defined in the per-edge option schema ([CONTRACTS section 2](CONTRACTS.md#2-options) shortcut).

**Parked to review first:** when writing the FFmpeg tasks, [P1 remux](PARKED.md#2-items), [P5 presets](PARKED.md#2-items) and [P14 naming patterns](PARKED.md#2-items). When writing the M1.3 image tasks, [P13 ICO sizes](PARKED.md#2-items). After M1, [P12 background removal](PARKED.md#2-items). When writing the M1.3 tasks, [P3 two-part extensions](PARKED.md#2-items) and [P11 HEIC](PARKED.md#2-items). After M1, [P6 watch folders](PARKED.md#2-items), [P7 command line](PARKED.md#2-items) and [P8 files opened while starting](PARKED.md#2-items).
