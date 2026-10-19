# fileCon — Conversion Checklist

Every conversion we do or plan to do, by phase. **If a conversion isn't on this list, it's out of scope.** To add one, first add it here and to [PRD section 5](PRD.md#5-features-by-milestone).

- Tick ☑ only when it works in the app **and** has a golden test.
- Engines and licenses: [TRD section 4](TRD.md#4-engine-matrix). How routes chain: [ARCH section 8](ARCHITECTURE.md#8-routing-algorithm).
- `→` means one file in, one file out. `→ pages` means one image per page, saved in a folder.

## 0. At a glance

| Category | Takes in | Gives out | Engine | Phase |
|---|---|---|---|---|
| Images | jpg, png, webp, avif, tiff, gif | any other image in this list · pdf (one image, or several combined) | built in | M1 |
| | bmp, ico, tga, psd, jxl, jp2, qoi, ppm, pcx, camera raw (dng, cr2, nef, arw…) | the M1 images · bmp, ico, tga, jxl, jp2, qoi (psd and raw are read only) | ImageMagick | M1.3 |
| Vector graphics | svg, svgz | png, jpg, webp · pdf (vector) | built in · LibreOffice | M1.3 |
| | emf, wmf | png · pdf · svg | LibreOffice | M1.3 |
| | eps, ps, ai | pdf · png | Ghostscript, which the user installs | M3 |
| PDF | pdf | one combined pdf | built in | M1 |
| | | png, jpg or tiff per page (pick pages and DPI) · the embedded images, untouched | Poppler | M1.1 |
| | | only the chosen pages · one pdf per page · one long png | built in (+ Poppler for the long image) | M1.1 |
| | scanned pdf | pdf with selectable text | OCRmyPDF | M3 |
| Word-style documents | doc, docx, odt, rtf | pdf | LibreOffice | M1 |
| | | png or jpg per page | LibreOffice + Poppler | M1.1 |
| | | one another, txt | LibreOffice | M1.2 |
| | | md, html, epub | LibreOffice + Pandoc | M1.2 |
| | docm, dotx, dotm, dot | docx · pdf · the others above | LibreOffice | M1.2 |
| Spreadsheets | xls, xlsx, ods, csv | pdf (from xlsx, ods) | LibreOffice | M1 |
| | | one another, csv | LibreOffice | M1.2 |
| | xlsm, xltx, tsv | xlsx · pdf · csv | LibreOffice | M1.2 |
| Slides | ppt, pptx, odp | pdf (from pptx, odp) | LibreOffice | M1 |
| | | png or jpg per slide | LibreOffice + Poppler | M1.1 |
| | | one another | LibreOffice | M1.2 |
| | pptm, potx, ppsx | pptx · pdf | LibreOffice | M1.2 |
| Markup and plain text | md, html, rst, latex, txt | one another · docx, odt, epub | Pandoc | M1.2 |
| | | doc, pdf | Pandoc + LibreOffice | M1.2 |
| E-books | epub | md, html, docx | Pandoc | M1.2 |
| | | pdf | Pandoc + LibreOffice | M1.2 |
| | epub, mobi, azw3, fb2, … | one another · pdf | calibre | M2 |
| Comics | cbz, cbr, cb7 | pdf · cbz | built in · 7-Zip | M1.3 |
| Combine | a mix of images, pdfs and office files | a single pdf, in the order you set | built in (+ LibreOffice for office files) | M1 |
| Video | mp4, mkv, webm, mov, avi, wmv, flv, ts, mpg, 3gp, m4v, ogv | one another · audio track · animated gif | FFmpeg | M1.1 |
| Audio | mp3, wav, flac, ogg, m4a, aac, opus, wma, aiff, m4b | one another | FFmpeg | M1.1 |
| Subtitles | srt, vtt, ass | one another · the text track out of a video | FFmpeg | M1.3 |
| Fonts | ttf, otf, woff, woff2, eot | one another (otf → ttf converts the outlines) | built in | M1.3 |
| Data | json, yaml, toml, xml, csv | one another (csv only for table-shaped data) | built in | M1.3 |
| Archives | zip, 7z, tar, tar.gz, tar.bz2, tar.xz, rar | a folder (extract) · one another (rar is read only) · many files → one archive | 7-Zip | M1.3 |
| Email | eml, msg | html · pdf · the attachments | built in (+ LibreOffice for pdf) | M3 |
| 3D models | obj, fbx, gltf, glb, stl, ply, dae | one another | Assimp | M2 |
| Blender scenes | blend | obj, fbx, gltf, stl | Blender | M2 |
| 2D CAD | dwg, dxf | dwg ↔ dxf · pdf, svg, png | ODA File Converter | M3 |
| 3D CAD | step, iges | stl, obj, gltf (approximated mesh) | FreeCAD / OpenCASCADE | M3 |

"Built in" means nothing extra to install (sharp, pdf-lib). Every other engine is an optional pack: fileCon only asks for it the first time a conversion needs it, and shows how to get it. Versions and licenses: [TRD section 4](TRD.md#4-engine-matrix).

## 1. Phase M1 — Images, Office and PDF basics

**Image ↔ image** (sharp, built in)

| From | To |
|---|---|
| ☑ jpg | png · webp · avif · tiff · gif |
| ☑ png | jpg · webp · avif · tiff · gif |
| ☑ webp | jpg · png · avif · tiff · gif |
| ☑ avif | jpg · png · webp · tiff · gif |
| ☑ tiff | jpg · png · webp · avif · gif (first page only) |
| ☑ gif | jpg · png · webp · avif · tiff (first frame only) |
| ☑ jpg, webp, avif | the same format again, at another quality (re-encode) |
| ☑ png, tiff, gif | the same format again (resize, grayscale) |

- ☑ Resize: width and/or height, aspect kept, never enlarged
- ☑ Grayscale
- ☑ Photo info (EXIF, GPS): stripped by default, kept on request. Photos always come out upright
- ☑ TIFF compression: LZW, Deflate, JPEG or none

Images larger than the target format allows (JPEG 65,500 px, GIF 65,535 px, AVIF 16,384 px, WebP 16,383 px a side) are scaled down to fit, and the result says so.

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

**PDF pages** (pdf-lib, built in)

- ☐ pdf → pdf with only the chosen pages
- ☐ Split a pdf into one pdf per page (optionally only some pages)
- ☐ One long image: a pdf's pages, or several images, stacked into one tall png
- ☐ One-click Poppler install on Windows, plus install commands on macOS and Linux

**Chained automatically** (needs Office pack + PDF pack)

- ☐ doc, docx, odt, pptx… → png or jpg pages (Office → pdf → pages)
- ☐ Image → pdf → … is never needed. Images convert directly.

**Video ↔ video** (FFmpeg, Media pack)

- ☐ mp4 ↔ mkv ↔ webm ↔ mov
- ☐ avi, wmv, flv, ts, mpg, 3gp, m4v, ogv ↔ the formats above
- ☐ Resolution option: keep, 2160p, 1080p, 720p, 480p (aspect kept, never upscaled)

**Audio ↔ audio** (FFmpeg)

- ☐ mp3 ↔ wav ↔ flac ↔ ogg ↔ m4a
- ☐ aac, opus, wma, aiff, m4b ↔ the formats above
- ☐ Bitrate option for lossy audio: 96–320 kbps

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
- ☐ Word variants: docm, dotx, dotm, dot → docx · pdf · the others (macros are dropped)
- ☐ Spreadsheet variants: xlsm, xltx → xlsx · pdf · csv · tsv ↔ csv · xlsx
- ☐ Slide variants: pptm, potx, ppsx → pptx · pdf
- ☐ New formats to register: txt, csv, tsv and the variants above (xls, ppt and svg are already registered for detection, M0-5)

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

## 3a. Phase M1.3 — Breadth

More formats with the engines and patterns M1 to M1.2 already built. New packs: Imaging (ImageMagick) and Archive (7-Zip).

**More images** (ImageMagick, Imaging pack)

- ☐ bmp, ico, tga, jxl, jp2, qoi ↔ the M1 images
- ☐ psd → M1 images (flattened, read only)
- ☐ ppm, pcx → M1 images
- ☐ Camera raw (dng, cr2, cr3, nef, arw, orf, rw2, raf) → jpg · png · tiff (read only)
- ☐ ico output holds several sizes (16 to 256 px)

**Vector graphics**

- ☐ svg, svgz → png · jpg · webp (sharp, built in). Scripts never run and nothing is fetched from the network
- ☐ svg → pdf, kept as vectors (LibreOffice Draw)
- ☐ emf, wmf → png · pdf · svg (LibreOffice Draw)

**Fonts** (built in)

- ☐ ttf ↔ otf ↔ woff ↔ woff2 ↔ eot

**Data** (built in)

- ☐ json ↔ yaml ↔ toml ↔ xml
- ☐ csv ↔ json (an array of rows); other data → csv only when it's a table

**Subtitles** (FFmpeg, Media pack)

- ☐ srt ↔ vtt ↔ ass
- ☐ Video → srt · vtt · ass (the first text track)

**Archives** (7-Zip, Archive pack)

- ☐ zip, 7z, tar, tar.gz, tar.bz2, tar.xz, rar → a folder (extract)
- ☐ zip ↔ 7z ↔ tar ↔ tar.gz ↔ tar.bz2 ↔ tar.xz (rar → the others; rar is never written)
- ☐ Many files → one archive (a new combiner)
- ☐ Design first: extraction safety (no paths outside the target folder, size and file-count limits against zip bombs), two-part extensions ([PARKED P3](PARKED.md#2-items))

**Comics**

- ☐ cbz → pdf (built in) · cbr, cb7 → pdf (7-Zip)
- ☐ pdf → cbz (Poppler pages, zipped)

## 4. Phase M2 — 3D

**Mesh formats** (Assimp, 3D pack)

- ☐ obj ↔ fbx ↔ gltf ↔ glb ↔ stl ↔ ply ↔ dae

**Blender files** (Blender, 3D pack)

- ☐ blend → obj · fbx · gltf · stl

**E-books** (calibre, E-book pack)

- ☐ epub ↔ mobi ↔ azw3 ↔ fb2
- ☐ epub, mobi, azw3, fb2 → pdf · txt · html
- ☐ Read only: azw, prc, lit, pdb → epub

## 5. Phase M3 — CAD and OCR

**CAD drawings** (ODA File Converter, which the user installs)

- ☐ dwg ↔ dxf
- ☐ dwg, dxf → pdf · svg · png

**CAD solids** (FreeCAD / OpenCASCADE, marked lossy)

- ☐ step, iges → stl · obj · gltf

**PostScript** (Ghostscript, which the user installs. fileCon never bundles or downloads it: [TRD section 5](TRD.md#5-license-constraints))

- ☐ eps, ps → pdf · png
- ☐ ai → pdf (an ai saved as PDF-compatible needs no engine) · png
- ☐ pdf → eps · ps

**Email** (built in, + LibreOffice for pdf)

- ☐ eml, msg → html · pdf · txt
- ☐ eml, msg → their attachments, in a folder
- ☐ msg → eml

**OCR** (OCRmyPDF)

- ☐ Scanned pdf → searchable pdf

**Engines**

- ☐ One-click download for every pack with a redistributable build

## 6. Ideas, not scheduled

These are noted so they aren't forgotten, but they're **not in scope**. Each one needs a PRD entry and a phase before any work starts.

| Idea | Likely engine | Why not now |
|---|---|---|
| heic / heif → jpg, png | OS decoders or ImageMagick | HEVC patent/licensing questions. See [PARKED P11](PARKED.md#2-items) |
| pdf → docx | LibreOffice / other | Layout is only approximate (lossy, cost 8) |
| Animated gif / multi-page tiff → frames | sharp | Needs per-frame fan-out |
| Password-protected pdf | Poppler | Needs password input UI |
