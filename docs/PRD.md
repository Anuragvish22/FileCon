# fileCon — Product Requirements (PRD)

Status: draft v0 · Owner: Anurag · Related: [TRD](TRD.md) · [Architecture](ARCHITECTURE.md) · [UI Design](UI-DESIGN.md) · [Index](INDEX.md)

## 1. Problem

Converting files today means one of two bad options:
- A pile of single-purpose tools (an image converter, an office suite, a PDF merger, a video tool), each with its own UI.
- Uploading files to online converters, which is slow on big files and a privacy risk for personal or work documents.

## 2. Vision

One offline desktop app for Windows, macOS and Linux. You drop files in, pick a target format, and get the result.
fileCon doesn't implement formats itself. It **routes** each conversion through mature open engines (libvips, LibreOffice, FFmpeg, Blender…), chaining them when no single engine can do the job.

## 3. Users

| Persona | Needs | Success looks like |
|---|---|---|
| **Everyday user** | Convert a few files with no setup | Drag, drop, pick a format, done in under 3 clicks |
| **Power user** | Big batches, control over engines and quality | Engine paths, priorities and output folder are configurable, and failures explain themselves |
| **Developer (you)** | Learn the architecture and extend it | Adding a converter is one file plus one test ([ARCH section 14](ARCHITECTURE.md#14-extensibility)) |

## 4. Goals and non-goals

**Goals**
- G1: Small base install. Images and PDF work with no extra downloads.
- G2: Heavy engines are optional **packs**, used when already installed or added on demand.
- G3: Be honest about quality. Every lossy route says what gets lost before the user converts.
- G4: Safe by default. The app never overwrites or modifies a source file.
- G5: Runs the same on Windows, macOS and Linux.
- G6: Ready for other languages and looks. The UI follows the OS theme and locale, offers light, dark and accent colors, and adding a language is one translation file.

**Non-goals (v1)**
- Explorer, Finder or Nautilus context-menu integration
- Watch folders, CLI, cloud sync or any network conversion
- Editing file contents (cropping, PDF page editing, and so on)
- Languages other than English. The UI is translation-ready (G6), but only English ships in v1.
- User-made theme files or a theme editor.
- Supporting literally every format. Proprietary formats come only where a usable engine exists.

## 5. Features by milestone

Each feature lists its acceptance criteria (AC). A milestone ships only when every AC passes on all three OSes.

### M1 — Core MVP
| ID | User story | Acceptance criteria |
|---|---|---|
| F1 | As a user I convert images between common formats | jpg, png, webp, avif, tiff and gif all convert to each other. Output opens in the OS default viewer, and dimensions are preserved. A quality option (1–100) applies to lossy targets |
| F2 | As a user I convert office docs to PDF | doc, docx, odt, rtf, xlsx, ods, pptx and odp convert to pdf through LibreOffice. The page count is greater than 0 |
| F3 | As a user I combine many files into one PDF | Select N images and/or docs, reorder them, then get one PDF with the pages in that order. Page size for images can be auto, A4 or Letter |
| F4 | As a user I batch convert | Select N files or drop a folder (up to 1000 files), pick one target, and get N outputs. One failure doesn't stop the others |
| F5 | As a user I see the real format of each file | Detection uses file content. A `.jpg` that's actually WebP shows a mismatch badge and still converts correctly |
| F6 | As a user my originals are safe | Output never overwrites anything. Name conflicts become `name (1).ext` |
| F7 | As a user I only see conversions that can actually run | The target list shows reachable formats only. Formats that need a missing pack are marked, with an install link |
| F8 | As a user I can cancel | Cancelling stops the engine process within 2 s and leaves no temp files or partial output |

### M1.1
- F9: pdf → png, jpg and tiff, one image per page (Poppler), with an optional page range (`2-3,7`) and DPI. Saved in a `<name> (png)/` folder as `page-002.png`… (named by real page).
- F21: Extract embedded images from a PDF, losslessly in their original formats, into `<name> (images)/`. An optional page range applies. "No images found" is reported as info.
- F22: One-click install of the PDF pack (Poppler) on Windows. macOS and Linux get copyable install commands and a Re-check button. This is F20's mechanism, pulled forward for this one engine.
- F10: Audio and video through FFmpeg (video: mp4, mkv, webm, mov, avi, wmv, flv, ts, mpg, 3gp, m4v, ogv · audio: mp3, wav, flac, ogg, m4a, aac, opus, wma, aiff, m4b), including video → audio and video → gif.
- F11: Engines page showing each pack as found or missing, with its path override.

### M1.2
- F12: Markup and ebooks through Pandoc (md, html, docx, epub, odt, rst, latex, plus txt input). Chains with Office give md → doc and pdf, and doc → md.
- F23: Office ↔ Office through LibreOffice: doc, docx, odt and rtf between each other and → txt · xls, xlsx and ods between each other plus csv ↔ · ppt, pptx and odp between each other.
- F23b: Office variants through LibreOffice: docm, dotx, dotm, dot · xlsm, xltx, tsv · pptm, potx, ppsx.
- F13: Output preview before saving (images and the PDF first page).
- F14: Signed or unsigned installers for all three OSes, built by CI.

### M1.3 — Breadth
- F24: More images through ImageMagick: bmp, ico, tga, jxl, jp2, qoi ↔ the M1 images; psd, ppm, pcx and camera raw read.
- F25: Vector graphics: svg and svgz → png, jpg, webp (sharp) and → pdf as vectors; emf and wmf → png, pdf, svg (LibreOffice).
- F26: Fonts: ttf, otf, woff, woff2 and eot convert to each other, built in.
- F27: Data: json, yaml, toml and xml convert to each other; csv ↔ json for tables. Built in.
- F28: Subtitles: srt, vtt and ass convert to each other, and a video's text track can be saved (FFmpeg).
- F29: Archives through 7-Zip: extract zip, 7z, tar (+ gz, bz2, xz) and rar to a folder, convert between them (rar read only), and pack many files into one archive. Extraction never writes outside its folder and stops at size limits.
- F30: Comics: cbz, cbr and cb7 → pdf, and pdf → cbz.

### M2 — 3D
- F15: Mesh formats obj, fbx, gltf, glb, stl, ply and dae convert to each other through Assimp.
- F16: `.blend` export to obj, fbx, gltf and stl through headless Blender.
- F31: E-books through calibre: epub, mobi, azw3 and fb2 to each other and → pdf, txt, html.

### M3 — CAD and more
- F17: DWG ↔ DXF and DWG/DXF → pdf, svg and png (ODA File Converter, which the user installs).
- F18: STEP and IGES → stl, obj and gltf (FreeCAD or OpenCASCADE), marked lossy.
- F19: OCR turns scanned PDFs into searchable PDFs (OCRmyPDF).
- F32: eps, ps and ai → pdf and png, pdf → eps and ps, through a Ghostscript the user installs (never shipped by fileCon).
- F33: Email: eml and msg → html, pdf, txt and their attachments; msg → eml.
- F20: One-click engine pack download, with checksums verified, for every pack that has a redistributable build (the mechanism already exists from F22).

## 6. Success metrics

- M1 features F1–F8 pass on Windows 11, macOS 14+ and Ubuntu 22.04+ with no network connection.
- The base installer is about 120 MB or less. Engines aren't bundled.
- A batch of 20 mixed files completes, and the UI stays responsive throughout (no frame longer than 100 ms).
- Typical files (under 10 MB) finish in under 5 s for images and under 15 s for office → PDF.
- Zero source-file modifications across the whole golden test suite.

## 7. Differentiators

fileCon aims to go further than existing offline converters on:
1. Cross-platform from day one.
2. Content-based (magic-byte) format detection, not extension-based.
3. A lossy note on every route, shown in the UI before converting.
4. Engines isolated in a separate core process and child processes, with timeouts and auto-restart, so a bad file can't crash the app.
5. 3D (obj, fbx, gltf, .blend) and broader CAD (STEP, IGES).
6. A golden-file regression suite across engine upgrades.
7. OCR.

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Proprietary formats (DWG, newer Adobe formats) have no open reader | Some conversions impossible | Use the ODA converter the user installs. List what's unsupported clearly |
| Engine size (LibreOffice is about 300 MB, Blender is bigger) | Heavy installs | Optional packs, plus detection of existing installs |
| Engine licenses (GPL, AGPL, restricted) | Distribution blocked | Call engines as separate processes, check licenses per engine ([TRD section 5](TRD.md#5-license-constraints)) |
| Engines hang or crash on malformed files | Stuck jobs | Timeouts, process kill and isolation ([ARCH section 9](ARCHITECTURE.md#9-job-runner)) |
| Engine output varies by version | Flaky tests | Golden tests check that output parses, not byte hashes |
