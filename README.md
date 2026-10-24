# fileCon

Convert files offline. Drop them in, pick a target format, and fileCon routes the job through mature engines on your own machine.

## What it does

fileCon is a desktop app for Windows, macOS and Linux (Electron and React). It converts images, documents and, later, audio, video and 3D files, and it can merge several files into one PDF. Nothing is uploaded: there are no network calls and no telemetry.

## How it works

1. **Find engines.** At startup it looks for the engines installed on your machine.
2. **Detect.** It reads each file's content, not just its extension, so a `.jpg` that is really a WebP is flagged.
3. **Route.** It searches a graph of conversions for the cheapest path to your target, and warns when a step loses quality.
4. **Run isolated.** Each step runs as a separate process with a timeout and a private temp folder, under your own permissions. Cancelling stops it and cleans up.
5. **Commit safely.** Results are written to a temp folder first, then linked into place without replacing anything.

**Never overwrites.** Your source files are never written to, moved or deleted. If `name.png` exists, the output becomes `name (1).png`.

## Status

Milestone M1 (the core MVP) is in progress. What is in scope is listed in [CONVERSIONS](docs/CONVERSIONS.md). There are no installers yet.

## Setup

You need Node 22 and pnpm (through corepack). For document conversion, install LibreOffice.

```
pnpm i
pnpm dev
```

| Command           | What it does                    |
| ----------------- | ------------------------------- |
| `pnpm dev`        | run the app                     |
| `pnpm test`       | all tests                       |
| `pnpm typecheck`  | `tsc --noEmit` in every package |
| `pnpm lint`       | eslint and prettier             |
| `pnpm docs:check` | every docs link resolves        |
| `pnpm build`      | package for the current OS      |

## Docs

Start at [docs/INDEX](docs/INDEX.md). The main ones are the [PRD](docs/PRD.md), the [architecture](docs/ARCHITECTURE.md), the [contracts](docs/CONTRACTS.md) and the [build plan](docs/BUILD-PLAN.md).

## License

[MIT](LICENSE). Engines keep their own licenses, see [TRD section 4](docs/TRD.md#4-engine-matrix).
