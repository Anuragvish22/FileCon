# fileCon — Conversion Checklist

Every conversion we do or plan to do, by phase. **If a conversion isn't on this list, it's out of scope.** To add one, first add it here and to [PRD section 5](PRD.md#5-features-by-milestone).

- Tick ☑ only when it works in the app **and** has a golden test.
- Engines and licenses: [TRD section 4](TRD.md#4-engine-matrix). How routes chain: [ARCH section 8](ARCHITECTURE.md#8-routing-algorithm).
- `→` means one file in, one file out. `→ pages` means one image per page, saved in a folder.

## 0. At a glance

| Category | Takes in | Gives out | Engine | Phase |
|---|---|---|---|---|
| Images | jpg, png, webp, avif, tiff, gif | any other image in this list · pdf (one image, or several combined) | built in | M1 |
| PDF | pdf | one combined pdf | built in | M1 |
| | | png, jpg or tiff per page (pick pages and DPI) · the embedded images, untouched | Poppler | M1.1 |
| | scanned pdf | pdf with selectable text | OCRmyPDF | M3 |
| Word-style documents | doc, docx, odt, rtf | pdf | LibreOffice | M1 |
| | | png or jpg per page | LibreOffice + Poppler | M1.1 |
| | | one another, txt | LibreOffice | M1.2 |
| | | md, html, epub | LibreOffice + Pandoc | M1.2 |
| Spreadsheets | xls, xlsx, ods, csv | pdf (from xlsx, ods) | LibreOffice | M1 |
| | | one another, csv | LibreOffice | M1.2 |
| Slides | ppt, pptx, odp | pdf (from pptx, odp) | LibreOffice | M1 |
| | | png or jpg per slide | LibreOffice + Poppler | M1.1 |
| | | one another | LibreOffice | M1.2 |
| Markup and plain text | md, html, rst, latex, txt | one another · docx, odt, epub | Pandoc | M1.2 |
| | | doc, pdf | Pandoc + LibreOffice | M1.2 |
| E-books | epub | md, html, docx | Pandoc | M1.2 |
| | | pdf | Pandoc + LibreOffice | M1.2 |
| Combine | a mix of images, pdfs and office files | a single pdf, in the order you set | built in (+ LibreOffice for office files) | M1 |
| Video | mp4, mkv, webm, mov | one another · audio track as mp3 or m4a · animated gif | FFmpeg | M1.1 |
| Audio | mp3, wav, flac, ogg, m4a | one another | FFmpeg | M1.1 |
| 3D models | obj, fbx, gltf, glb, stl, ply, dae | one another | Assimp | M2 |
| Blender scenes | blend | obj, fbx, gltf, stl | Blender | M2 |
| 2D CAD | dwg, dxf | dwg ↔ dxf · pdf, svg, png | ODA File Converter | M3 |
| 3D CAD | step, iges | stl, obj, gltf (approximated mesh) | FreeCAD / OpenCASCADE | M3 |

"Built in" means nothing extra to install (sharp, pdf-lib). Every other engine is an optional pack: fileCon only asks for it the first time a conversion needs it, and shows how to get it. Versions and licenses: [TRD section 4](TRD.md#4-engine-matrix).

## 1. Phase M1 — Images, Office and PDF basics

**Image ↔ image** (sharp, built in)

| From | To |
|---|---|
| ☐ jpg | png · webp · avif · tiff · gif |
| ☐ png | jpg · webp · avif · tiff · gif |
| ☐ webp | jpg · png · avif · tiff · gif |
| ☐ avif | jpg · png · webp · tiff · gif |
| ☐ tiff | jpg · png · webp · avif · gif (first page only) |
| ☐ gif | jpg · png · webp · avif · tiff (first frame only) |

**Image → PDF** (pdf-lib, built in)

- ☐ Single jpg → pdf
- ☐ Single png → pdf
- ☐ Single webp, avif, tiff or gif → pdf (via png automatically)
- ☐ Multiple images → one pdf (merge, in your order)
- ☐ Page size option: auto, A4 or Letter

**Office → PDF** (LibreOffice, Office pack)

- ☐ doc, docx, odt, rtf → pdf
- ☐ xlsx, ods → pdf
- ☐ pptx, odp → pdf

**Merge into one PDF** (merge-pdf)

- ☐ Multiple PDFs → one pdf
- ☐ Multiple Office docs → one pdf
- ☐ Mixed images + Office docs + PDFs → one pdf, in your order

**Batch**

- ☐ Many files → the same target format, each as its own output
- ☐ Drop a folder (up to 1000 files)

## 2. Phase M1.1 — PDF to images, audio and video

**PDF → images** (Poppler, PDF pack)

- ☐ pdf → png pages
- ☐ pdf → jpg pages (with quality)
- ☐ pdf → tiff pages
- ☐ Page range option (`2-3,7`) and DPI
- ☐ Extract embedded images from a pdf (originals, lossless)
- ☐ One-click Poppler install on Windows, plus install commands on macOS and Linux

**Chained automatically** (needs Office pack + PDF pack)

- ☐ doc, docx, odt, pptx… → png or jpg pages (Office → pdf → pages)
- ☐ Image → pdf → … is never needed. Images convert directly.

**Video ↔ video** (FFmpeg, Media pack)

- ☐ mp4 ↔ mkv ↔ webm ↔ mov

**Audio ↔ audio** (FFmpeg)

- ☐ mp3 ↔ wav ↔ flac ↔ ogg ↔ m4a

**Video → other** (FFmpeg)

- ☐ Video → audio (mp4 → mp3, mkv → m4a, …)
- ☐ Video → gif (marked lossy)

## 3. Phase M1.2 — Documents and markup

**Pandoc** (Docs pack)

- ☐ md ↔ html ↔ docx ↔ odt ↔ epub ↔ rst ↔ latex
- ☐ txt → md · html · docx (plain text in)

**Office ↔ Office** (LibreOffice, Office pack, already installed for M1)

- ☐ Documents: doc ↔ docx ↔ odt ↔ rtf, and → txt (txt is lossy: formatting lost)
- ☐ Spreadsheets: xls ↔ xlsx ↔ ods, and → csv (csv is lossy: first sheet only, no formulas or styles)
- ☐ csv → xlsx · ods
- ☐ Presentations: ppt ↔ pptx ↔ odp
- ☐ New formats to register: txt, csv, xls, ppt

**Chained automatically** (Docs pack + Office pack)

- ☐ md → doc (md → docx → doc)
- ☐ md → pdf (md → docx → pdf)
- ☐ doc → md (doc → docx → md)
- ☐ html → pdf · doc (html → docx → …)
- ☐ epub → pdf · docx
- ☐ odt, rtf → md · html · epub (→ docx → …)
- ☐ txt → pdf

**Other**

- ☐ Output preview before saving (images, PDF first page)

## 4. Phase M2 — 3D

**Mesh formats** (Assimp, 3D pack)

- ☐ obj ↔ fbx ↔ gltf ↔ glb ↔ stl ↔ ply ↔ dae

**Blender files** (Blender, 3D pack)

- ☐ blend → obj · fbx · gltf · stl

## 5. Phase M3 — CAD and OCR

**CAD drawings** (ODA File Converter, which the user installs)

- ☐ dwg ↔ dxf
- ☐ dwg, dxf → pdf · svg · png

**CAD solids** (FreeCAD / OpenCASCADE, marked lossy)

- ☐ step, iges → stl · obj · gltf

**OCR** (OCRmyPDF)

- ☐ Scanned pdf → searchable pdf

**Engines**

- ☐ One-click download for every pack with a redistributable build

## 6. Ideas, not scheduled

These are noted so they aren't forgotten, but they're **not in scope**. Each one needs a PRD entry and a phase before any work starts.

| Idea | Likely engine | Why not now |
|---|---|---|
| heic / heif → jpg, png | sharp + libheif | HEVC patent/licensing questions |
| svg → png, jpg | sharp | Easy. Decide whether it belongs in M1.2 |
| pdf → docx | LibreOffice / other | Layout is only approximate (lossy, cost 8) |
| epub ↔ mobi ↔ azw3 | calibre | New engine and pack |
| Archives (zip, 7z) and "compress into one archive" | 7-Zip | New combiner kind |
| Animated gif / multi-page tiff → frames | sharp | Needs per-frame fan-out |
| Camera raw (dng, cr2, nef) → jpg | libraw | New engine |
| Password-protected pdf | Poppler | Needs password input UI |
