# fileCon — Technical Requirements (TRD)

Status: draft v0 · Related: [PRD](PRD.md) · [Architecture](ARCHITECTURE.md) · [UI Design](UI-DESIGN.md) · [Index](INDEX.md)

This doc says **what the system must satisfy**. [ARCHITECTURE](ARCHITECTURE.md) says **how it's built**, and [CONTRACTS](CONTRACTS.md) defines every type, message and error code these requirements mention.

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Shell | Electron (latest stable) with electron-vite | Node-native, so sharp and pdf-lib run directly. TS end to end |
| UI | React 18+ with TypeScript (`strict: true`) | Familiar, large ecosystem |
| Runtime | Node 22 LTS | Matches the Electron Node version family |
| Packages | pnpm workspace (`packages/core`, `packages/app`) | Keeps core independent of the shell |
| Tests | vitest | Fast, native TS/ESM |
| Packaging | electron-builder | NSIS, dmg, AppImage and deb from one config |
| Lint/format | ESLint (typescript-eslint) + Prettier | Standard |

## 2. Functional requirements

| ID | Requirement | Verified by |
|---|---|---|
| FR-1 | Detect format from content (magic bytes) first, extension second. Report a mismatch when they disagree | Unit tests with renamed fixtures |
| FR-2 | Build a format graph from the converters whose engine is **available** | Unit test with mocked `available()` |
| FR-3 | Find the cheapest route from source to target, **max 3 hops**. Ties go to the user's engine priority | Graph unit tests |
| FR-4 | Every route reports the lossy notes of all its edges | Graph unit tests |
| FR-5 | For multiple inputs, offer only targets reachable from **every** input | Unit test |
| FR-6 | Merge: route every input to the combiner's input format, then run the combiner (for example `merge-pdf`) | Golden test |
| FR-7 | Output naming: `<dir>/<stem>.<ext>`, adding ` (n)` on conflict. Multi-output goes in a `<stem> (<ext>)/` folder. Never overwrite, using an exclusive commit ([ARCH section 10](ARCHITECTURE.md#10-output-commit)) | Unit test, including a concurrent race |
| FR-8 | Jobs run concurrently with per-job progress (indeterminate allowed), cancellation and a `CoreError` failure reason | Integration test |
| FR-9 | Engine discovery checks the user override, then PATH, then known install dirs per OS | Unit test with fake FS |
| FR-10 | One job failing in a batch doesn't affect the others | Integration test |
| FR-11 | Folder drops expand recursively, skipping hidden entries, capped at 1000 files | Unit test |
| FR-12 | Conversion options (`quality`, `dpi`, `pageSize`, `pages`) are validated and applied only where the route supports them | Unit + golden test |
| FR-13 | PDF → image renders only the pages in `pages` (grammar in [CONTRACTS section 2](CONTRACTS.md#2-options)), named by real page number | Unit + golden test |
| FR-14 | "Extract images" writes every embedded image of the chosen pages in its stored format, without re-encoding | Golden test (byte-identical) |
| FR-15 | An engine with a `download` install method installs in one click: confirm, download, SHA-256 verify, unpack, re-discover. A `command` method shows copyable commands | Unit test with a local HTTPS server |

## 3. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | Conversion work runs only in the **core host** (an Electron `utilityProcess`) or in engine child processes, never in main or the renderer |
| NFR-2 | Performance | Default concurrency is `max(1, os.cpus().length - 1)`. LibreOffice runs one at a time |
| NFR-3 | Reliability | Every engine call has a timeout (default 120 s, per-converter override) and an `AbortSignal` |
| NFR-4 | Reliability | Each job's temp dir is removed on done, failed, cancelled and app quit. Leftover temp dirs from crashes are swept on startup |
| NFR-5 | Reliability | Outputs are written to temp first, then **moved** into place, so no partial files appear at the destination |
| NFR-6 | Security | Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP, no remote content |
| NFR-7 | Security | Engines spawn with an argument array. `shell: true` is forbidden |
| NFR-8 | Security | Input files are untrusted. Paths from the renderer are validated in main (absolute, exists, regular file) |
| NFR-9 | Portability | OS-specific code lives only in `core/src/engines/discovery.ts` and the app packaging config |
| NFR-10 | Size | Engine binaries are never bundled in the installer or committed to the repo |
| NFR-11 | Privacy | No network calls except user-initiated engine downloads (M3). No telemetry |
| NFR-12 | Reliability | A core host crash never takes down the UI. Running jobs fail with `CORE_CRASHED`, and the host restarts (at most 3 times in 60 s) ([FLOWS F12](FLOWS.md#f12-core-crash-and-recovery)) |
| NFR-13 | Localization | All user-facing text comes from locale files through `t()`. Core sends ids, codes and params, never prose. Every key core can emit exists in `en.json` (tooling test) ([CONTRACTS section 10](CONTRACTS.md#10-text-and-themes)) |
| NFR-14 | Accessibility | Every color is a theme token. Text and controls meet 4.5:1 contrast in light and dark mode for every accent (unit test on the tokens) |

## 4. Engine matrix

| Engine | Pack | Mode | Formats (in → out) | License | Milestone |
|---|---|---|---|---|---|
| sharp (libvips) | builtin | in core host | jpg, png, webp, avif, tiff, gif ↔ each other (M1) · svg, svgz → raster (M1.3) | Apache-2.0 / LGPL libvips | M1, M1.3 |
| pdf-lib | builtin | in core host | jpg, png → pdf; merge pdf | MIT | M1 |
| LibreOffice | office | child process | doc, docx, odt, rtf, xlsx, ods, pptx, odp → pdf (M1) · Office ↔ Office incl. txt, csv, xls, ppt and the docm/xlsm/pptm-style variants (M1.2) · svg → pdf, emf/wmf → png, pdf, svg (M1.3) | MPL-2.0 | M1, M1.2, M1.3 |
| Poppler (`pdftoppm`, `pdfimages`, `pdfinfo`) | pdf | child process | pdf → png, jpg, tiff (per page) · extract embedded images · page count | GPL-2.0+ (Windows build packaging: MIT) | M1.1 |
| FFmpeg | media | child process | audio and video ↔ each other, video → gif (M1.1) · subtitles srt, vtt, ass (M1.3) | LGPL or GPL build | M1.1, M1.3 |
| Pandoc | docs | child process | md, html, docx, epub, odt, rst, latex | GPL-2.0 | M1.2 |
| ImageMagick (`magick`) | imaging | child process | bmp, ico, tga, jxl, jp2, qoi ↔ images · psd, ppm, pcx, camera raw read | ImageMagick License (Apache-2.0 style) | M1.3 |
| 7-Zip (`7zz` / `7z`) | archive | child process | zip, 7z, tar (+ gz, bz2, xz) ↔ each other · rar read only · extract · pack | LGPL-2.1 + unRAR restriction (rar extract only) | M1.3 |
| Built-in libraries (fonts, data, comics, email) | builtin | in core host | ttf, otf, woff, woff2, eot · json, yaml, toml, xml, csv · cbz · eml, msg | permissive only (MIT, BSD, Apache); each one is chosen and asked for in its task | M1.3, M3 |
| calibre (`ebook-convert`) | ebook | child process | epub, mobi, azw3, fb2 ↔ each other · → pdf, txt, html | GPL-3.0 | M2 |
| Ghostscript (`gs`, `gswin64c`) | postscript | child process, **detect only** | eps, ps, ai → pdf, png · pdf → eps, ps | AGPL-3.0 | M3 |
| Assimp CLI | 3d | child process | obj, fbx, gltf, glb, stl, ply, dae | BSD-3 | M2 |
| Blender | 3d | child process (`-b --python`) | blend → obj, fbx, gltf, stl | GPL-2.0+ | M2 |
| ODA File Converter | cad | child process | dwg ↔ dxf | Proprietary, free to use | M3 |
| FreeCAD / OCCT | cad | child process | step, iges → stl, obj, gltf | LGPL-2.1 | M3 |
| OCRmyPDF | ocr | child process | pdf → searchable pdf | MPL-2.0 | M3 |

**Discovery paths (examples, kept in `discovery.ts`):**
- LibreOffice: Windows `C:\Program Files\LibreOffice\program\soffice.exe` · macOS `/Applications/LibreOffice.app/Contents/MacOS/soffice` · Linux `soffice` on PATH, plus `/usr/bin`, `/opt/libreoffice*/program` and `/snap/bin`.
- Others: PATH first, then user override. Known dirs are added when needed.

## 5. License constraints

- Engines are **invoked as separate processes**, never linked, except sharp and pdf-lib, which are permissively licensed.
- **Ghostscript (AGPL) is detect-only**: fileCon never bundles it and never offers a download. If the user installed it, it's found like any engine and run as a separate process, which doesn't put fileCon under the AGPL. The Engines page shows install commands. MuPDF (AGPL) is not used.
- Use **Poppler** for PDF rasterizing and extraction. It's GPL, which is fine because it's only ever invoked as a separate process.
- Poppler is never bundled in the installer:
  - Windows: users get a one-click download of the pinned `oschwartz10612/poppler-windows` release, fetched from GitHub at their request and verified by SHA-256.
  - macOS and Linux: users install it with their package manager.
- FFmpeg: if the app ever bundles it (M3 download), use an **LGPL** build.
- **ODA File Converter** can't be redistributed. The user installs it and fileCon only detects it.
- LibreDWG (GPL, incomplete) is not planned.
- Before adding any engine: record its license in section 4 and confirm that invoking it as a process is allowed.

## 6. Testing strategy

Tests live in `<package>/test/`, mirroring `src/` (`src/jobs/output.ts` → `test/jobs/output.test.ts`), never next to the source. `test/tooling/layout.test.ts` enforces this.

| Layer | What | How |
|---|---|---|
| Unit | graph, routing, detection, output naming, discovery | vitest, pure functions, no engines |
| Golden | each converter edge | `test/fixtures/<fmt>/` inputs → convert → assert the output **parses**: `file-type` matches, image dimensions or PDF page count are as expected. **No byte hashes**, with one exception: extraction (`pdfimages`) must be **byte-identical** to the embedded originals, because being lossless is its whole point |
| Engine-gated | anything that needs an external engine | `describe.skipIf(!(await conv.available()))`, so CI without LibreOffice still passes |
| Integration | job runner | Cancel mid-job (no temp left, no output), timeout, a batch with one bad file |
| Manual | UI | Checklist in [UI-DESIGN section 7](UI-DESIGN.md#7-accessibility) plus a smoke test per OS before release |

Rule: a converter isn't done until it has at least one golden test per edge family.

### Converter must-pass set

Every converter, combiner and extractor test calls one shared helper, `runConverterContract(conv, fixture)` in `core/test/contract.ts`. It is engine-gated like the golden tests and asserts:
1. Outputs are only inside `req.outDir`, and each exists with size > 0.
2. The source file's bytes, mtime and size are unchanged.
3. Aborting `ctx.signal` mid-run → `CANCELLED`, no output, temp dir gone.
4. A zero-byte or corrupt input → a `CoreError` (not a raw throw), temp dir gone.
5. An input name with spaces, unicode and shell metacharacters (`; $() &&`) converts correctly.
6. Every `edges` entry has a `cost` on the [ARCH section 8](ARCHITECTURE.md#8-routing-algorithm) scale, and `lossy` is set where the edge loses quality or data.

This set sits on top of each task's own "Must also pass" list in [BUILD-PLAN](BUILD-PLAN.md).

## 7. Build and release

- Dev: run inside WSL2 with WSLg (`pnpm dev`). Install engines with apt for local testing.
- CI: GitHub Actions matrix on `windows-latest`, `macos-latest` and `ubuntu-latest`. Lint, typecheck, test, then build.
- Artifacts: NSIS `.exe` (Windows), `.dmg` (macOS, universal or arm64+x64), `.AppImage` and `.deb` (Linux).
- sharp's prebuilt binaries are per-platform, so each OS builds natively in CI. No cross-building.
- Code signing is out of scope for v1. Users will see an unsigned-app warning, and the README documents it.

## 8. Tauri port path

- `@filecon/core` has **no Electron imports**. Lint enforces this with `no-restricted-imports` on `electron`.
- The core already runs as a separate process (the core host) and speaks the JSON-RPC envelopes in [CONTRACTS section 6](CONTRACTS.md#6-core-rpc-protocol) over `parentPort`.
- Port plan: start the same `core/src/host.ts` as a Node **sidecar**, with the transport switched to stdio (newline-delimited JSON). The server code doesn't change. Rewrite only main (in Rust), the preload bridge and packaging. The React renderer is reused behind the same `window.filecon` shape.
