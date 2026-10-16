# fileCon — Docs Index

Read this first, then open **only** the sections the task needs.
Headings are numbered and stable. If you rename or renumber one, update this file in the same change.

## By task

| Task | Read |
|---|---|
| Add a converter | [ARCH section 3](ARCHITECTURE.md#3-core-interfaces) · [ARCH section 9](ARCHITECTURE.md#9-extensibility) · [TRD section 4](TRD.md#4-engine-matrix) · [TRD section 6](TRD.md#6-testing-strategy) |
| Add an engine pack or discovery path | [TRD section 4](TRD.md#4-engine-matrix) · [TRD section 5](TRD.md#5-license-constraints) · [ARCH section 7](ARCHITECTURE.md#7-engine-discovery-and-packs) |
| Touch routing or the graph | [ARCH section 4](ARCHITECTURE.md#4-data-flow) · [TRD section 2](TRD.md#2-functional-requirements) (FR-2 to FR-5) |
| Touch jobs, temp files, cancel, spawn | [ARCH section 6](ARCHITECTURE.md#6-job-runner) · [TRD section 3](TRD.md#3-non-functional-requirements) |
| Merge or combine | [ARCH section 5](ARCHITECTURE.md#5-merge-n-to-1) |
| Add or change an IPC channel | [ARCH section 8](ARCHITECTURE.md#8-ipc-contract) · [TRD section 3](TRD.md#3-non-functional-requirements) (NFR-6 to NFR-8) |
| Build or change a screen | [UI section 2](UI-DESIGN.md#2-screens) to [UI section 6](UI-DESIGN.md#6-components) · [ARCH section 8](ARCHITECTURE.md#8-ipc-contract) |
| Accessibility check | [UI section 7](UI-DESIGN.md#7-accessibility) |
| Scope or priority question | [PRD section 4](PRD.md#4-goals-and-non-goals) · [PRD section 5](PRD.md#5-features-by-milestone) |
| CI, packaging, release | [TRD section 7](TRD.md#7-build-and-release) |
| Why X was chosen | [ARCH section 10](ARCHITECTURE.md#10-adr-log) |

## PRD.md — what and why

| Section | Covers |
|---|---|
| [1. Problem](PRD.md#1-problem) · [2. Vision](PRD.md#2-vision) · [3. Users](PRD.md#3-users) | Context, personas |
| [4. Goals and non-goals](PRD.md#4-goals-and-non-goals) | G1 to G5, what v1 won't do |
| [5. Features by milestone](PRD.md#5-features-by-milestone) | F1 to F20 with acceptance criteria, M1 to M3 |
| [6. Success metrics](PRD.md#6-success-metrics) | Size, speed, OS targets |
| [7. Differentiators](PRD.md#7-differentiators) · [8. Risks](PRD.md#8-risks) | Positioning, mitigations |

## TRD.md — technical requirements

| Section | Covers |
|---|---|
| [1. Stack](TRD.md#1-stack) | Electron, React, pnpm, vitest, electron-builder |
| [2. Functional requirements](TRD.md#2-functional-requirements) | FR-1 to FR-10 |
| [3. Non-functional requirements](TRD.md#3-non-functional-requirements) | NFR-1 to NFR-11: perf, reliability, security, portability |
| [4. Engine matrix](TRD.md#4-engine-matrix) | Engine, pack, formats, license, milestone, discovery paths |
| [5. License constraints](TRD.md#5-license-constraints) | What can be called, bundled or avoided |
| [6. Testing strategy](TRD.md#6-testing-strategy) | Unit, golden, engine-gated, integration |
| [7. Build and release](TRD.md#7-build-and-release) · [8. Tauri port path](TRD.md#8-tauri-port-path) | CI matrix, installers, sidecar port |

## ARCHITECTURE.md — how it's built

| Section | Covers |
|---|---|
| [1. Overview](ARCHITECTURE.md#1-overview) | Diagram, core/app boundary |
| [2. Repo layout](ARCHITECTURE.md#2-repo-layout) | Where each module lives |
| [3. Core interfaces](ARCHITECTURE.md#3-core-interfaces) | **Type source of truth**: Edge, Converter, Combiner, JobCtx, Route, Job |
| [4. Data flow](ARCHITECTURE.md#4-data-flow) | detect → plan → submit → run → finish |
| [5. Merge](ARCHITECTURE.md#5-merge-n-to-1) | Combiner flow |
| [6. Job runner](ARCHITECTURE.md#6-job-runner) | Temp dirs, concurrency, spawn, worker pool, output naming |
| [7. Engine discovery and packs](ARCHITECTURE.md#7-engine-discovery-and-packs) | Lookup order, listEngines, downloads |
| [8. IPC contract](ARCHITECTURE.md#8-ipc-contract) | Every channel and payload |
| [9. Extensibility](ARCHITECTURE.md#9-extensibility) | Adding a converter or combiner |
| [10. ADR log](ARCHITECTURE.md#10-adr-log) | ADR-1 to ADR-7 |

## UI-DESIGN.md — screens and UX

| Section | Covers |
|---|---|
| [1. Principles](UI-DESIGN.md#1-principles) · [2. Screens](UI-DESIGN.md#2-screens) | UX rules, screen list |
| [3. Wireframes](UI-DESIGN.md#3-wireframes) | ASCII layouts |
| [4. Flows](UI-DESIGN.md#4-flows) · [5. States](UI-DESIGN.md#5-states) | User flows, every component state |
| [6. Components](UI-DESIGN.md#6-components) · [7. Accessibility](UI-DESIGN.md#7-accessibility) | Component list, a11y checklist |

## Glossary

| Term | Meaning |
|---|---|
| Format | Canonical lowercase id (`jpg`, `pdf`). Aliases are mapped in `formats.ts` |
| Edge | One conversion a converter can do: `from → to`, with `cost` and an optional `lossy` note |
| Route | A cheapest chain of edges from source to target, max 3 **hops** (edges) |
| Converter | Adapter around one engine. Declares edges and implements `convert` |
| Combiner | N-to-1 operation outside the graph (for example `merge-pdf`) |
| Engine | External tool or library doing the real work (LibreOffice, sharp…) |
| Pack | Optional group of engines (`office`, `media`, `3d`…). Missing packs drop their edges |
| JobCtx | Per-step context: abort signal, temp dir, progress callback |
| Golden test | A fixed fixture is converted, and the test asserts the output parses correctly. Not a byte hash |
| Mismatch | The detected (content) format differs from the extension |
