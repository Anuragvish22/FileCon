# fileCon — Parked ideas

Status: living list · Related: [Build Plan](BUILD-PLAN.md) · [Conversions](CONVERSIONS.md) · [PRD](PRD.md) · [Index](INDEX.md)

Ideas we chose **not** to build yet, each with the moment to look at it again. Conversions that aren't scheduled live in [CONVERSIONS section 6](CONVERSIONS.md#6-ideas-not-scheduled); this list holds everything else (behavior, UX, tooling).

## 1. How this list works

- Every item has a **Revisit at** trigger: a BUILD-PLAN task, or an event such as "when FFmpeg tasks are written".
- A task with a trigger here carries a **Parked to review first** line in [BUILD-PLAN](BUILD-PLAN.md). Before starting that task, raise those items with the user and decide: adopt (write it into the matching doc and the task), re-park (new trigger) or drop (keep the row, status `dropped`, with the reason).
- New parked ideas are added here in the same change that parks them, never only in chat or memory.
- Status: `parked` · `adopted` (with where it went) · `dropped` (with why).

## 2. Items

| ID | Idea | Source | Revisit at | Status |
|---|---|---|---|---|
| P1 | **Remux instead of re-encode.** When the target container accepts the source's codecs (H.264/HEVC + AAC → mp4/mov, VP9 + Opus → webm), copy the streams (`-c copy`): seconds instead of minutes, no quality loss. Re-encode only the stream that doesn't fit | reference review | When the FFmpeg tasks are written ([BUILD-PLAN section 5](BUILD-PLAN.md#5-after-m1)) | parked |
| P2 | **Keep the source's dates** (mtime, and birthtime where the OS allows) on converted files, so photos still sort by when they were taken. Not for merged or multi-source outputs. Probably a setting | reference review | [M0-6](BUILD-PLAN.md#m0-6-output-commit-) | dropped: a converted file is a new file, and users expect a new date (online converters behave the same). Decided at M0-6 |
| P3 | **Two-part extensions** (`tar.gz`, `tar.xz`): `byExt` and stems must check known compound extensions before the last part | reference review | When the M1.3 archive tasks are written ([CONVERSIONS section 3a](CONVERSIONS.md#3a-phase-m13--breadth)) | parked |
| P4 | **Raster-source-only edges.** An edge flag so image → svg tracing runs only when the original file is a raster image, never on a pdf or svg that was rendered to png on the way | reference review | When any raster → vector edge is proposed | parked |
| P5 | **Presets:** saved option sets per file type (quality, size, dpi, output folder, naming), picked in one click | reference review | When the per-edge option schema arrives with FFmpeg options ([CONTRACTS section 2](CONTRACTS.md#2-options) shortcut) | parked |
| P6 | **Watch folders:** convert files that land in a folder automatically, skipping files still being written and the output folder itself | reference review | After M1, when PRD milestones are next reviewed ([PRD section 5](PRD.md#5-features-by-milestone)) | parked |
| P7 | **Command line** (`filecon convert …`, JSON output, exit codes) reusing core without the UI | reference review | After M1, with P6 | parked |
| P8 | **Files opened while the app starts** (OS "Open with", second instance) are queued until core is `ready`, not dropped. Other apps have lost them on slow machines | reference review | When shell integration is planned ([FLOWS F1](FLOWS.md#f1-app-startup) shortcut) | parked |
| P9 | **Fonts in office → pdf.** A docx in Hindi, Chinese or Arabic renders as boxes when the machine lacks a font for that script. Decide whether to detect and warn (a run-time note) or document it | reference review | [M1-4](BUILD-PLAN.md#m1-4-converters-and-combiner-) | parked |
| P11 | **HEIC / HEIF read** (iPhone photos). HEVC is patent-encumbered, so sharp's standard build can't read it. Options discussed 2026-10-16: (1) use decoders already on the machine, detect only: macOS `sips` (built in), Linux `heif-convert` / ImageMagick, Windows ImageMagick; (2) bundle a libde265 WebAssembly decoder (best on Windows, but we'd distribute an HEVC decoder); (3) leave it out. Writing HEIC stays out in every option | reference review | When the M1.3 image tasks are written ([CONVERSIONS section 3a](CONVERSIONS.md#3a-phase-m13--breadth)) | parked |
| P12 | **Background removal** from photos. Needs a 100+ MB AI model and an ONNX runtime, far bigger than everything else | feature review | After M1, with P6 | parked |
| P13 | **Choosing ICO sizes** (today an ico always holds 16 to 256 px) | feature review | When the M1.3 image tasks are written ([CONVERSIONS section 3a](CONVERSIONS.md#3a-phase-m13--breadth)) | parked |
| P14 | **Output naming patterns** such as `{name}-{width}` | feature review | With P5 presets | parked |
| P15 | **Direct-only edges.** An edge flag for conversions that are right as a whole route but wrong as a step inside a longer one: pdf → pptx as page pictures is fine for a pdf, but a docx rendered to pdf must not end up as pictures on slides | reference review | When any such edge is proposed (pdf → pptx, or pdf → docx used on the way to another format) | parked |
| P16 | **Routes that need two packs.** `needs-pack` names only the first missing pack, so a route needing office and media asks for office, then for media. Options: list every missing pack, or prefer the route that needs the fewest | reference review | M3, when pack downloads are built | parked |
| P17 | **Every frame of a video, opt-in only.** pdf pages fan out by default, but a video would give about 30 files a second. A video → image-sequence edge must run only when the user asks, and only as a whole route | reference review | When a video → image-sequence edge is proposed | parked |
| P18 | **Verify container contents.** Zip-based (docx, xlsx, pptx, odt, ods, odp) and CFB-based (doc, xls, ppt) files are told apart by extension only, so a renamed zip passes detection and fails later in LibreOffice. Option: peek inside (zip entries `word/`, `xl/`, `ppt/`, `mimetype`; CFB directory stream names) and set `mismatch` | M0-5 review | [M1-4](BUILD-PLAN.md#m1-4-converters-and-combiner-), or sooner if misdetected Office files are reported | parked |
| P10 | **Automatic check that `core/src/types/` matches the CONTRACTS code blocks**, so the mirror can't drift (today it's kept in sync by hand) | M0-2 review | [M1-5](BUILD-PLAN.md#m1-5-rpc-server-and-core-host-), before RPC starts using most types | parked |
