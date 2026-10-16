# fileCon — Docs Index

Read this first, then open **only** the sections the task needs.
Headings are numbered and stable. If you rename or renumber one, update this file in the same change. `pnpm docs:check` verifies the links (from M0-1 on).

| Doc | Answers |
|---|---|
| [PRD](PRD.md) | What we build and why, features and acceptance criteria |
| [TRD](TRD.md) | Requirements (FR/NFR), engines, licenses, testing, release |
| [ARCHITECTURE](ARCHITECTURE.md) | Processes, modules, layering, algorithms, ADRs |
| [CONTRACTS](CONTRACTS.md) | **Every type, RPC method, IPC channel, error code and setting** (source of truth) |
| [FLOWS](FLOWS.md) | Step-by-step sequence diagrams for every behavior |
| [BUILD-PLAN](BUILD-PLAN.md) | Ordered M0/M1 tasks: files, tests, done-when |
| [CONVERSIONS](CONVERSIONS.md) | **At-a-glance From → To table, plus a checklist of every conversion by phase.** If it's not there, it's out of scope |
| [UI-DESIGN](UI-DESIGN.md) | Screens, wireframes, states, accessibility |

## By task

| Task | Read |
|---|---|
| Start or continue building | [BUILD-PLAN](BUILD-PLAN.md): find the first ☐ task, then read the sections it links |
| Add a converter | [CONVERSIONS](CONVERSIONS.md) (is it in scope for this phase?) · [ARCH section 14](ARCHITECTURE.md#14-extensibility) · [CONTRACTS section 1](CONTRACTS.md#1-domain-types) · [ARCH section 8](ARCHITECTURE.md#8-routing-algorithm) (cost scale) · [TRD section 4](TRD.md#4-engine-matrix) · [TRD section 6](TRD.md#6-testing-strategy) |
| Add or change a format | [ARCH section 6](ARCHITECTURE.md#6-format-registry) · [ARCH section 7](ARCHITECTURE.md#7-detection-algorithm) |
| Add an engine or discovery path | [ARCH section 11](ARCHITECTURE.md#11-engine-discovery) · [CONTRACTS section 9](CONTRACTS.md#9-engines) · [TRD section 4](TRD.md#4-engine-matrix) · [TRD section 5](TRD.md#5-license-constraints) |
| Touch routing or targets | [ARCH section 8](ARCHITECTURE.md#8-routing-algorithm) · [FLOWS F3](FLOWS.md#f3-target-list) |
| Touch jobs, cancel, timeouts, temp | [ARCH section 9](ARCHITECTURE.md#9-job-runner) · [FLOWS F4](FLOWS.md#f4-single-convert) to [F9](FLOWS.md#f9-failure-and-retry) · [CONTRACTS section 4](CONTRACTS.md#4-jobs) |
| Touch output naming or saving | [ARCH section 10](ARCHITECTURE.md#10-output-commit) |
| Merge or combine | [FLOWS F7](FLOWS.md#f7-merge-to-pdf) · [ARCH section 9](ARCHITECTURE.md#9-job-runner) |
| PDF pages to images, page range | [FLOWS F14](FLOWS.md#f14-pdf-pages-to-images) · [ARCH section 8](ARCHITECTURE.md#8-routing-algorithm) (PDF edges) · [CONTRACTS section 2](CONTRACTS.md#2-options) (`pages`) |
| Extract embedded images, add an extractor | [FLOWS F15](FLOWS.md#f15-extract-embedded-images) · [ARCH section 9](ARCHITECTURE.md#9-job-runner) · [CONTRACTS section 1](CONTRACTS.md#1-domain-types) (`Extractor`) |
| Install an engine, pin a download | [FLOWS F16](FLOWS.md#f16-install-an-engine) · [ARCH section 11](ARCHITECTURE.md#11-engine-discovery) · [CONTRACTS section 9](CONTRACTS.md#9-engines) · [TRD section 5](TRD.md#5-license-constraints) |
| Add an RPC method or event | [CONTRACTS section 6](CONTRACTS.md#6-core-rpc-protocol) · [ARCH section 12](ARCHITECTURE.md#12-core-host-and-supervision) |
| Add an IPC channel | [CONTRACTS section 7](CONTRACTS.md#7-ipc-renderer--main) · [ARCH section 2](ARCHITECTURE.md#2-processes) · [TRD section 3](TRD.md#3-non-functional-requirements) (NFR-6 to NFR-8) |
| Add an error code | [CONTRACTS section 5](CONTRACTS.md#5-errors) · [FLOWS F9](FLOWS.md#f9-failure-and-retry) |
| Change settings | [CONTRACTS section 8](CONTRACTS.md#8-settings) · [FLOWS F11](FLOWS.md#f11-settings-change) |
| Add an option (quality, dpi…) | [CONTRACTS section 2](CONTRACTS.md#2-options) |
| Core crash, startup, quit | [ARCH section 12](ARCHITECTURE.md#12-core-host-and-supervision) · [FLOWS F1](FLOWS.md#f1-app-startup) · [F12](FLOWS.md#f12-core-crash-and-recovery) · [F13](FLOWS.md#f13-app-quit) |
| Where does module X go, what can it import | [ARCH section 3](ARCHITECTURE.md#3-repo-layout) · [ARCH section 4](ARCHITECTURE.md#4-layering) · [ARCH section 5](ARCHITECTURE.md#5-module-map) |
| Build or change a screen | [UI section 2](UI-DESIGN.md#2-screens) to [UI section 6](UI-DESIGN.md#6-components) · [ARCH section 13](ARCHITECTURE.md#13-renderer-architecture) |
| Accessibility check | [UI section 7](UI-DESIGN.md#7-accessibility) |
| Is conversion X planned? Which phase? | [CONVERSIONS](CONVERSIONS.md) |
| Scope or priority question | [PRD section 4](PRD.md#4-goals-and-non-goals) · [PRD section 5](PRD.md#5-features-by-milestone) |
| CI, packaging, release | [TRD section 7](TRD.md#7-build-and-release) · [BUILD-PLAN M1-8](BUILD-PLAN.md#m1-8-ci-matrix-) |
| Why X was chosen | [ARCH section 15](ARCHITECTURE.md#15-adr-log) |

## ARCHITECTURE.md

| Section | Covers |
|---|---|
| [1. Overview](ARCHITECTURE.md#1-overview) · [2. Processes](ARCHITECTURE.md#2-processes) | Process diagram, what each process owns and must never do |
| [3. Repo layout](ARCHITECTURE.md#3-repo-layout) · [4. Layering](ARCHITECTURE.md#4-layering) · [5. Module map](ARCHITECTURE.md#5-module-map) | Where files go, import rules, module APIs and tests |
| [6. Format registry](ARCHITECTURE.md#6-format-registry) · [7. Detection algorithm](ARCHITECTURE.md#7-detection-algorithm) | M1 formats, how detection resolves |
| [8. Routing algorithm](ARCHITECTURE.md#8-routing-algorithm) | Graph build, cost scale, bounded Bellman-Ford, fan-out, targets |
| [9. Job runner](ARCHITECTURE.md#9-job-runner) · [10. Output commit](ARCHITECTURE.md#10-output-commit) | Scheduling, steps, progress, cancel, never-overwrite commit |
| [11. Engine discovery](ARCHITECTURE.md#11-engine-discovery) · [12. Core host and supervision](ARCHITECTURE.md#12-core-host-and-supervision) | Finding engines, install assistant and pins, process lifecycle, crash recovery |
| [13. Renderer architecture](ARCHITECTURE.md#13-renderer-architecture) · [14. Extensibility](ARCHITECTURE.md#14-extensibility) · [15. ADR log](ARCHITECTURE.md#15-adr-log) | Store slices, adding converters, ADR-1 to ADR-15 |

## CONTRACTS.md

| Section | Covers |
|---|---|
| [1. Domain types](CONTRACTS.md#1-domain-types) · [2. Options](CONTRACTS.md#2-options) | Format, Edge, Converter, Combiner, Route, ConvertOptions |
| [3. Detection and planning](CONTRACTS.md#3-detection-and-planning) · [4. Jobs](CONTRACTS.md#4-jobs) | DetectResult, TargetsResult, JobRequest, Job, legal transitions |
| [5. Errors](CONTRACTS.md#5-errors) | CoreError, every ErrorCode with message and retryability |
| [6. Core RPC protocol](CONTRACTS.md#6-core-rpc-protocol) · [7. IPC](CONTRACTS.md#7-ipc-renderer--main) | Main ⇄ core methods and events, renderer ⇄ main channels, path validation |
| [8. Settings](CONTRACTS.md#8-settings) · [9. Engines](CONTRACTS.md#9-engines) | Settings schema, defaults, storage, EngineInfo, EngineSpec |

## FLOWS.md

| Section | Covers |
|---|---|
| [1. State machines](FLOWS.md#1-state-machines) | Job, file row, core host |
| [F1](FLOWS.md#f1-app-startup) startup · [F2](FLOWS.md#f2-add-files-and-detect) add files · [F3](FLOWS.md#f3-target-list) targets | Getting to "ready to convert" |
| [F4](FLOWS.md#f4-single-convert) single · [F5](FLOWS.md#f5-multi-hop-with-fan-out) multi-hop · [F6](FLOWS.md#f6-batch) batch · [F7](FLOWS.md#f7-merge-to-pdf) merge | Running conversions |
| [F8](FLOWS.md#f8-cancel) cancel · [F9](FLOWS.md#f9-failure-and-retry) failure | Stopping and failing |
| [F10](FLOWS.md#f10-missing-engine-then-set-path) engine path · [F11](FLOWS.md#f11-settings-change) settings · [F12](FLOWS.md#f12-core-crash-and-recovery) crash · [F13](FLOWS.md#f13-app-quit) quit | Environment and lifecycle |
| [F14](FLOWS.md#f14-pdf-pages-to-images) PDF pages · [F15](FLOWS.md#f15-extract-embedded-images) extract · [F16](FLOWS.md#f16-install-an-engine) install engine | PDF features and the install assistant (M1.1) |

## BUILD-PLAN.md

| Section | Covers |
|---|---|
| [1. M0](BUILD-PLAN.md#1-m0--core-logic) | M0-1 scaffold to M0-6 output commit |
| [2. M1](BUILD-PLAN.md#2-m1--mvp) | M1-1 spawn to M1-8 CI |
| [3. Smoke checklist](BUILD-PLAN.md#3-m1-smoke-checklist) | Manual M1 release checks |
| [4. M1.1 PDF to images](BUILD-PLAN.md#4-m11--pdf-to-images) · [5. After M1](BUILD-PLAN.md#5-after-m1) | M1.1-1 pages parser to M1.1-5 UI, what comes next |

## CONVERSIONS.md

| Section | Covers |
|---|---|
| [0. At a glance](CONVERSIONS.md#0-at-a-glance) | One From → To table by category, with phase and the engine each needs |
| [1. M1](CONVERSIONS.md#1-phase-m1--images-office-and-pdf-basics) · [2. M1.1](CONVERSIONS.md#2-phase-m11--pdf-to-images-audio-and-video) · [3. M1.2](CONVERSIONS.md#3-phase-m12--documents-and-markup) | Checklists: images, Office → PDF, merge · PDF pages, extract, media · Pandoc, Office ↔ Office, chains |
| [4. M2](CONVERSIONS.md#4-phase-m2--3d) · [5. M3](CONVERSIONS.md#5-phase-m3--cad-and-ocr) · [6. Ideas](CONVERSIONS.md#6-ideas-not-scheduled) | 3D · CAD, OCR · unscheduled ideas (out of scope) |

## PRD.md · TRD.md · UI-DESIGN.md

| Section | Covers |
|---|---|
| PRD [1](PRD.md#1-problem)–[3](PRD.md#3-users) · [4](PRD.md#4-goals-and-non-goals) · [5](PRD.md#5-features-by-milestone) · [6](PRD.md#6-success-metrics) · [7](PRD.md#7-differentiators) · [8](PRD.md#8-risks) | Problem, users, goals, F1–F23, metrics, differentiators, risks |
| TRD [1](TRD.md#1-stack) · [2](TRD.md#2-functional-requirements) · [3](TRD.md#3-non-functional-requirements) · [4](TRD.md#4-engine-matrix) · [5](TRD.md#5-license-constraints) · [6](TRD.md#6-testing-strategy) · [7](TRD.md#7-build-and-release) · [8](TRD.md#8-tauri-port-path) | Stack, FR-1–15, NFR-1–12, engines, licenses, testing, release, Tauri |
| UI [1](UI-DESIGN.md#1-principles) · [2](UI-DESIGN.md#2-screens) · [3](UI-DESIGN.md#3-wireframes) · [4](UI-DESIGN.md#4-flows) · [5](UI-DESIGN.md#5-states) · [6](UI-DESIGN.md#6-components) · [7](UI-DESIGN.md#7-accessibility) | Principles, screens, wireframes, UX flows, states, components, a11y |

## Glossary

| Term | Meaning |
|---|---|
| Format | Canonical lowercase id (`jpg`, `pdf`). Aliases are mapped in `formats.ts` |
| Edge | One conversion a converter can do: `from → to`, with `cost`, `lossy`, `fanOut` and `options` |
| Route | Cheapest chain of edges, at most 3 **hops**, with at most one fan-out |
| Fan-out | An edge producing one file per page or frame (pdf → png). Later steps run per file, and the output goes to a folder |
| Converter / Combiner / Extractor | Adapter around one engine (1 → 1 or N) / N → 1 operation outside the graph (`merge-pdf`) / 1 → many files of mixed formats outside the graph (`pdfimages`) |
| Page range | The `pages` option (`2-3,7`). Outputs are named by real page number |
| Install assistant | Per-OS engine install: a pinned, checksum-verified download (`download`) or copyable commands (`command`) |
| Engine / Pack | The tool doing the real work / an optional group of engines. Missing packs drop their edges |
| Available / full graph | Edges of installed engines / all registered edges (used to show `needs-pack`) |
| Core host | The `utilityProcess` running `@filecon/core`, supervised and restarted by main |
| Job / Batch | One convert or merge / all jobs from one `submit` call |
| Exclusive commit | Saving output via `fs.link` so an existing file is never replaced |
| JobCtx | Per-step context: abort signal, temp dir, progress callback |
| Must also pass | The non-happy-path tests each [BUILD-PLAN](BUILD-PLAN.md) task lists: edge cases, errors, cancel, cleanup. Converters also pass the [TRD section 6](TRD.md#6-testing-strategy) must-pass set |
| Golden test | A fixed fixture is converted and the test asserts the output parses. Never a byte hash |
| Mismatch | The detected (content) format differs from the extension |
