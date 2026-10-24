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

### M1-5 RPC server and core host ☑
- **Parked to review first:** [P10 types vs CONTRACTS check](PARKED.md#2-items)
- **Depends on:** M1-2, M1-3, M1-4
- **Files:** `core/src/rpc/protocol.ts`, `core/src/rpc/server.ts`, `core/src/host.ts`
- **Details:** [CONTRACTS section 6](CONTRACTS.md#6-core-rpc-protocol).
  - `host.ts` exports `startHost({ port, exit })` and `createProductionRegistry`; it has no side effects on import, so M1-6's entry file calls it with `process.parentPort`.
  - shortcut: `engines.install` always gives `INVALID_REQUEST` (no engine has a download install yet) and `extract` requests are refused, until M1.1-3 and M1.1-4.
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

### M1-6 App main and preload ☑
Split into three changes (a, b, c) because it was too much for one. Tick this heading when all three are ☑. Tasks that depend on M1-6 need all three.
- **Parked to review first:** [P28 core log lines](PARKED.md#2-items) (adopted), [P29 settings validated twice](PARKED.md#2-items) (adopted)
- **Depends on:** M1-5
- **Details:** [ARCHITECTURE section 12](ARCHITECTURE.md#12-core-host-and-supervision) and [CONTRACTS section 7 and section 8](CONTRACTS.md#7-ipc-renderer--main).
- **Dependencies to add (approved, with 6c):** `electron`, `electron-vite`.

#### M1-6a Text, settings, paths and log ☑
- **Files:** `app/package.json`, `app/src/shared/i18n.ts` (`translate()`), `app/src/locales/en.json`, `app/src/main/{settings,paths,log}.ts`, and in core `rpc/server.ts` (`log` events).
- **Details:**
  - `shared/i18n.ts` and `locales/en.json` land here, because main's install-confirm dialog uses them ([CONTRACTS section 10](CONTRACTS.md#10-text-and-themes)).
  - Settings validation covers `ui.accent` and `ui.language`.
  - Core emits `log` events for a failed job and an engine re-probe, with codes and params only.
- **Tests:**
  - Happy path:
    - `settings.test.ts`: load and save round-trip
    - `paths.test.ts`: a valid file path is accepted
    - `i18n.test.ts`: `{param}` substitution, `.one` / `.other` plurals
  - Must also pass:
    - paths: a relative path, a path with `..`, and a non-string are refused
    - settings: invalid values rejected (including an unknown accent or locale), a corrupt settings file recovers to defaults
    - i18n: a missing key falls back to `en`, then to the key, warns once and never throws; a missing param leaves `{param}` visible
    - tooling test `test/tooling/i18n-keys.test.ts`: every key core can emit exists in `en.json`: `error.<code>` for all `ERROR_CODES`, `format.<id>` and `category.<c>` from `formats.ts`, `pack.<id>`, every converter's `lossy` id, every `invalid.<what>` core raises (extractor ids join with M1.1-3)
    - tooling test `test/tooling/settings-agree.test.ts`: core and main reject the same broken settings (P29)

#### M1-6b Core client and supervisor ☑
- **Depends on:** M1-6a
- **Files:** `app/src/main/{coreClient,supervisor}.ts`. Both take an injected fork or port, so they import no `electron`.
- **Tests:**
  - Happy path:
    - `supervisor.test.ts`: fake fork reaches ready
    - `coreClient.test.ts`: id matching
  - Must also pass:
    - supervisor: ready timeout, crash and restart, budget exhaustion, synthesized `CORE_CRASHED` updates
    - coreClient: timeouts, out-of-order responses

#### M1-6c Electron wiring ☑
- **Parked to review first:** [P32 log rotation](PARKED.md#2-items) (decided: rotate by size now)
- **Depends on:** M1-6b
- **Files:** `app/src/main/{index,ipc,expand,window}.ts`, `app/src/preload/{index,api}.ts`, `app/electron.vite.config.ts`, `app/src/renderer/index.html` (placeholder), `core/src/hostEntry.ts` (the core host entry)
- **Details:**
  - `webPreferences`: `contextIsolation`, `sandbox`, no `nodeIntegration`.
  - CSP: `default-src 'self'`.
  - Navigation and new windows are blocked.
  - `log.ts` also rotates mid-session once the file passes 1 MB (P32).
  - A failed call rejects in the renderer with the plain `CoreError` ([CONTRACTS section 7](CONTRACTS.md#7-ipc-renderer--main)).
  - `sharp` is an app dependency too, because the bundled host loads it at run time.
- **Tests:**
  - Must also pass:
    - preload exposes only `window.filecon`; `webPreferences` has `contextIsolation`, `sandbox` and no `nodeIntegration`
    - every channel in CONTRACTS section 7 has an `ipc.ts` handler (`test/tooling/ipc-channels.test.ts`, which also checks the preload methods and push channels against the doc)
    - `reveal` and `openExternal` refuse anything outside the allow-lists; a declined install confirm gives `CANCELLED`
  - Manual: `pnpm dev` opens a window under WSLg and the log shows `core status: ready`.
- **Parked:** [P36 one bad input rejects the whole submit](PARKED.md#2-items), [P37 Electron glue in `index.ts` is only run by hand](PARKED.md#2-items), [P38 main text ignores the language setting](PARKED.md#2-items), [P33](PARKED.md#2-items) (also `expand.ts`)

### M1-7 Renderer ☑
Split into three changes (a, b, c). Tick this heading when all three are ☑. Decisions: state is `useReducer` + context with no state library; React, not Next.js; P34, P35, P26 and P9 are built here (P30, P20, P25 stay parked).
- **Depends on:** M1-6
- **Details:** [ARCHITECTURE section 13](ARCHITECTURE.md#13-renderer-architecture) and [UI-DESIGN](UI-DESIGN.md). All text through `translate()`, all colors through theme tokens, CSS logical properties only ([CONTRACTS section 10](CONTRACTS.md#10-text-and-themes)).

#### M1-7a Foundations ☑
- **Files:** `app/src/renderer/{main.tsx,styles.css,theme/,store/,components/{AppShell,CoreBanner}.tsx}`, `shared/i18n.ts` (`resolveLocale`), `app/electron.vite.config.ts`, `eslint.config.js`, CONTRACTS section 5 (`CORE_TIMEOUT`).
- **Details:**
  - Store: `state`, `reducer`, `actions`, `selectors`, and `StoreProvider` (which also does `useCoreEvents`).
  - P35: no call before `core:status` is `ready`; drops are queued; startup calls re-run on every return to `ready`.
  - P34: a call with no answer in 30 s rejects with `CORE_TIMEOUT`; the host is not restarted for it.
  - Dependencies added: `react`, `react-dom`, `@vitejs/plugin-react`, `@testing-library/react`, `jsdom`, `eslint-plugin-react`.
- **Tests:** `store.test.ts` (reducer and selectors, add files → pick target → job done), `actions.test.ts` (P35 queueing), `tokens.test.ts` (4.5:1 for every accent × mode, `<html>` attributes), `test/tooling/jsx-literals.test.ts` (a JSX literal fails lint).
- **Parked:** [P39 renderer has no format categories](PARKED.md#2-items), [P40 renderer shares main's tsconfig](PARKED.md#2-items), [P37](PARKED.md#2-items) (CSP only checked in the built app)

#### M1-7b Convert page ☑
- **Parked to review first:** [P9](PARKED.md#2-items) (fixed note only), [P20](PARKED.md#2-items), [P25](PARKED.md#2-items) (jpg background built, concurrency stays parked), [P30](PARKED.md#2-items), [P39](PARKED.md#2-items) (adopted: `@filecon/core/formats`)
- **Depends on:** M1-7a
- **Files:** `renderer/components/{DropZone,FileList,TargetPicker,RouteHint,OptionsBar,OutputChooser,MergeToggle,ConvertButton}.tsx`, `renderer/pages/ConvertPage.tsx`, `renderer/format.ts`; in core `options.ts` and `converters/sharp.ts` for the new `background` option (CONTRACTS section 2).
- **Tests:** `convert.test.tsx` (empty state, TargetPicker arrows, Enter and typeahead, locked target can't be submitted, merge toggle rule, one request per file, Alt+Arrow reorder), `store.test.ts` (`pagesValid`), sharp golden for `background`.
- **Parked:** [P41 drag reorder, busy Convert button, step 2 of mismatch tooltip](PARKED.md#2-items)

#### M1-7c Jobs, Engines and Settings ☑
- **Parked to review first:** [P26](PARKED.md#2-items) (decided: no setting, a size-scaled timeout), [P41](PARKED.md#2-items) (busy button, locked merge link and drag handle built)
- **Depends on:** M1-7b
- **Files:** `renderer/components/{JobsPanel,useThrottled}`, `renderer/pages/{EnginesPage,SettingsPage}.tsx`, store (`submit`, `requests`, retry, reveal, engine actions); in core `jobs/timeout.ts`, `jobs/runner.ts`, `converters/libreoffice.ts`.
- **Details:**
  - A step's time limit is `timeoutMs` plus 4 s per MB of input, at most 30 minutes. Cancel is always available and a running row shows elapsed time.
  - Jobs panel: live region throttled to once a second, Show in folder, Details, Retry (same request), Cancel all, Clear finished.
  - Settings applies theme, accent, language, output folder and concurrency at once. Accent swatches carry text names, and their colors come from `--swatch-<accent>` tokens.
- **Tests:** `panels.test.tsx` (JobsPanel live region, failed row, Details, done row; Engines set path and guide; Settings theme and accent update `<html>`), `actions.test.ts` (busy submit, retry), `timeout.test.ts`, runner and LibreOffice tests for the scaled limit, `no-raw-colors.test.ts`.
- **Parked:** [P44](PARKED.md#2-items), [P45](PARKED.md#2-items), [P46](PARKED.md#2-items), [P47](PARKED.md#2-items)

### M1-F Foundation ☐
Goal: a repo a stranger can open, follow and trust before more features go in. The code is clean and minimal, the UI is designed rather than wireframed, and every failure path is tested. Tick this heading when F1 to F8 are ☑.

Decided at the M1-F review (2026-10-24):
- **Code is the source of truth for contracts.** Schemas in `core/src/types/` define every type, RPC method, IPC payload, setting and option. CONTRACTS.md describes them and links to the code, and the word-for-word copy goes away (F2).
- **Process docs stay where they are**: CLAUDE.md, BUILD-PLAN and PARKED remain in the repo, unchanged in role.
- **New dependencies allowed:** `zod` for schemas; Tailwind v4, Radix primitives (shadcn style) and `lucide-react` icons for the UI.
- **License: MIT.**

Found while reviewing the running app (screenshots of empty, files, done, failed, locked, Engines and Settings), each fixed by the task named:
- Nothing visible happens after Convert, because the jobs panel is below the fold (F7).
- The nav tab and the action button are both labeled "Convert" (F7).
- Unstyled native controls everywhere (F6 to F8).
- The 🔒 shows as a blank box on Linux, which has no emoji font (F6).
- Sizes show as raw bytes, and the unsupported row's columns are out of order (F7).
- Discovery sends English prose (`override path is not an executable file`), breaking ADR-16 (F3).
- `sort-arrow-sprite.jpg` is committed at the repo root, probably output from a manual test whose output folder was the repo (F1).

#### M1-F1 Repo front door ☑
- **Depends on:** M1-7
- **Files:** `README.md`, `LICENSE`, `package.json` (`license`), `.github/workflows/ci.yml` (Linux only), delete `sort-arrow-sprite.jpg`.
- **Details:**
  - README: a one-line pitch, what it does and why it's offline, the 5-step model (find engines → detect → route → run isolated → commit safely), a short note on how routing works, the never-overwrite guarantee, setup and commands, and links into `docs/`. The screenshot is added in F8, once the UI is proper.
  - Say **isolated**, not sandboxed: engines run as separate processes with a timeout and a private temp dir, under the user's own permissions.
  - CI runs lint, typecheck, test and `docs:check` on ubuntu with Node 22 and pnpm, so the refactors in F2 and F3 are guarded. M1-8 grows it into the 3-OS matrix.
- **Tests:**
  - Happy path: CI is green when run by hand (manual trigger only until M1-8).
  - Must also pass: `docs:check` resolves every README link.

#### M1-F2 Schemas as the source of truth ☑
- **Parked to review first:** [P10](PARKED.md#2-items) (the mirror check it replaces), [P40 renderer shares main's tsconfig](PARKED.md#2-items)
- **Depends on:** M1-F1
- **Files:** `core/src/types/*` (zod schemas, types via `z.infer`), `core/src/rpc/protocol.ts`, `core/src/options.ts`, `app/src/main/{ipc,settings}.ts`, `app/tsconfig.{node,web}.json` (P40), CONTRACTS (prose plus links to the code, no copied type blocks), remove `test/tooling/types-mirror.test.ts`, CLAUDE.md and INDEX (the source-of-truth rule), ARCHITECTURE section 15 (ADR-18).
- **Details:**
  - One schema per RPC method's params, IPC payload, `Settings` and `ConvertOptions`. The hand-written `fieldsOf` and `stringOf` helpers go.
  - Wire behavior is unchanged: a schema failure is still `INVALID_REQUEST`, with the same `what` ids for options (`quality-range`…). Settings still drop unknown keys.
  - The error codes and RPC method list are exported constants, which the docs and tooling tests read.
- **Tests:**
  - Happy path: the existing protocol, settings, options and ipc tests pass unchanged.
  - Must also pass:
    - every malformed shape those tests cover is still refused with the same code and `what`
    - unknown keys in settings are dropped
    - `ipc-channels` and `settings-agree` tooling tests read the exported constants

#### M1-F3 Core tidy-up ☑
- **Parked to review first:** [P48 GLib spam from sharp](PARKED.md#2-items), kept parked for M1-8 (P28 was already adopted)
- **Depends on:** M1-F2
- **Files:** `core/src/jobs/{runner,progress,plan,spawn}.ts`, `core/src/registry.ts`, `core/src/types/jobs.ts`, `core/src/engines/discovery.ts`, `core/src/index.ts` (delete), the matching app callers, CONTRACTS section 9, `en.json`.
- **Details:**
  - Split `runner.ts`: progress throttling and the never-backwards fraction go to `progress.ts`, `detectInput` plus `planRoute` go to `plan.ts`, one step goes to `steps.ts` and the combiner run to `combine.ts`, so the lifecycle and the convert and merge flows stay in `runner.ts` (about 270 lines).
  - One shared `TERMINAL_STATES` and `ACTIVE_STATES` in core, used by core, the supervisor and the reducer. `isConverter` lives only in `registry.ts`.
  - Rename spawn's `createRunner` to `createSpawn`, so only one thing is called runner.
  - `EngineInfo.error` becomes a code with params (`engine.error.<code>`), so the Engines page text comes from `en.json` (ADR-16).
  - Combiners get the same scaled timeout as steps.
  - Keep each file in `jobs/` and `rpc/` under about 250 lines.
- **Tests:**
  - Happy path: all runner tests pass unchanged against the split modules.
  - Must also pass:
    - a combiner that hangs → `TIMEOUT`, temp dir removed
    - each discovery failure gives its code, and no English text crosses RPC
    - `progress.ts` unit tests (throttle, trailing flush, never backwards)

#### M1-F4 Failure matrix ☐
- **Parked to review first:** [P35 calls during restart](PARKED.md#2-items), [P36 one bad input rejects the whole submit](PARKED.md#2-items), [P47 retry only in this session](PARKED.md#2-items)
- **Depends on:** M1-F3
- **Files:** `core/test/jobs/failures.test.ts`, `app/test/main/supervisor.test.ts`, `core/src/jobs/runner.ts` (resolved output check), FLOWS F9 and F12 test lists.
- **Details:**
  - One table-driven test per subsystem, with every row a fault × a state.
  - `verifyOutputs` resolves symlinks (`realpath`) before the inside-the-temp-dir check, ending its shortcut.
- **Tests:**
  - Happy path: a batch of 5 with no faults ends with 5 `done`.
  - Must also pass, each ending with no temp dir, no child process and the source unchanged:
    - engine exits non-zero, engine hangs past its timeout
    - input deleted or made unreadable between detect and run
    - output folder read-only, disk full (`ENOSPC`)
    - cancel while queued, while in step 1 of 2, during commit
    - core host killed mid-batch → every active job `CORE_CRASHED`, then new jobs work after restart
    - a converter that writes a symlink pointing outside its out dir → `ENGINE_OUTPUT_MISSING`

#### M1-F5 UI design pass ☐
- **Parked to review first:** [P41 Convert-page gaps](PARKED.md#2-items), [P42 lone PDF message](PARKED.md#2-items), [P9 font note](PARKED.md#2-items)
- **Depends on:** M1-7 (can run alongside F2 to F4)
- **Files:** UI-DESIGN sections 3 to 6 (docs only).
- **Details:**
  - One screen for the main job: the drop zone shrinks once files exist; file rows have one fixed column order (name, format badge, size in KB/MB, status, remove); targets are grouped chips; options appear only for the chosen target; a sticky bottom bar holds Save to and the Convert button; jobs show in a panel that stays visible after Convert.
  - The nav names pages, not actions, so "Convert" labels only the button.
  - A state matrix: rows are UI elements, columns are app states (empty, detecting, ready, busy, running, done, partial, failed, cancelled, locked, core unavailable).
  - Icons from `lucide-react` replace emoji.
- **Gate:** the user approves the wireframes and the state matrix before F6.

#### M1-F6 UI foundations ☐
- **Parked to review first:** [P43 dev CSP](PARKED.md#2-items)
- **Depends on:** M1-F5
- **Files:** `app/package.json`, `app/electron.vite.config.ts`, `renderer/styles.css`, `renderer/theme/`, `renderer/components/ui/` (Button, Badge, Chip, Select, Checkbox, RadioGroup, Progress, Tooltip, Dialog), ARCHITECTURE sections 13 and 15 (ADR-19), `eslint.config.js`.
- **Details:**
  - Tailwind v4 with its theme read from the existing tokens, so colors still come only from tokens and the contrast test still applies.
  - Primitives are copied into the repo shadcn-style (Radix underneath), not imported as a kit.
  - Logical properties only: Tailwind's `ms-`/`me-`/`ps-`/`pe-` utilities; lint refuses `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`.
- **Tests:**
  - Happy path: each primitive renders, takes focus and has its accessible name.
  - Must also pass: `tokens.test.ts` (4.5:1, both themes, every accent), `no-raw-colors`, `jsx-literals`, the new lint rule.

#### M1-F7 Convert screen rebuild ☐
- **Depends on:** M1-F6
- **Files:** `renderer/components/*`, `renderer/pages/ConvertPage.tsx`, `renderer/format.ts` (human sizes), `en.json`. Store, reducer, selectors and actions stay, changed only where the state matrix needs it.
- **Details:** build exactly the F5 wireframes and state matrix.
- **Tests:**
  - Happy path: drop 3 files → pick a chip → Convert → the jobs panel is visible and shows 3 done rows with Show in folder.
  - Must also pass:
    - every cell of the state matrix (one test per column at least)
    - keyboard-only flow (Tab, arrows, Enter, Space, Alt+Arrow reorder)
    - a mismatch row, an unsupported row, a locked chip that opens Engines
    - `ui-core-targets.test.ts` still feeds the real `targets()` result

#### M1-F8 Engines, Settings and verification ☐
- **Parked to review first:** [P44 Settings gaps](PARKED.md#2-items), [P45 install progress](PARKED.md#2-items)
- **Depends on:** M1-F7
- **Files:** `renderer/pages/{EnginesPage,SettingsPage}.tsx`, README screenshots, the M1 smoke checklist (section 3).
- **Details:** rebuilt on the F6 primitives. Then a manual pass: the smoke checklist on Linux, keyboard only, Orca screen reader, both themes and every accent.
- **Tests:**
  - Happy path: set an engine path, change theme and accent, choose an output folder.
  - Must also pass: an invalid engine path shows its translated error; the existing `panels.test.tsx` cases.

### M1-8 CI matrix ☐
- **Parked to review first:** [P33 app modules on Windows and macOS](PARKED.md#2-items), [P37 packaging: `sharp` unpacked, Electron glue untested](PARKED.md#2-items), [P19 find LibreOffice on any Windows drive](PARKED.md#2-items), [P22 pdf-lib is unmaintained](PARKED.md#2-items), [P23 field-level metadata check](PARKED.md#2-items), [P24 sharp on Windows and macOS](PARKED.md#2-items), [P27 LibreOffice converter on Windows and macOS](PARKED.md#2-items)
- **Depends on:** M1-F
- **Files:** `.github/workflows/ci.yml` (grows the Linux workflow from M1-F1)
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
- **Parked to review first:** [P31 hand-written invalid ids](PARKED.md#2-items)
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
