# PDF (pdf-lib and merge)

Test entries read: `file`: "test name". Files are under `packages/*/test/`.

## Shared across all platforms

### Image to PDF

- [x] Happy path: JPG and PNG become a one-page PDF. `pdflib.test.ts`: "happy path" › `it.each(['jpg', 'png'])`
- [x] JPG and PNG to PDF cost 1, are not lossy, and honour `pageSize`. `pdflib.test.ts`: "jpg and png → pdf are cost 1 and not lossy, and honour pageSize"
- [x] A WebP reaches PDF through sharp and PNG, at cost 3. `pdflib.test.ts`: "a webp reaches pdf through sharp and png, at cost 3"; "a webp becomes a one-page pdf through the whole route"
- [x] The shared converter contract passes. `pdflib.test.ts`: "contract"
- [x] A corrupt JPG is `ENGINE_FAILED` and leaves no temp folder. `pdflib.test.ts`: "a corrupt jpg is ENGINE_FAILED and leaves no temp dir"
- [x] An EXIF-rotated JPG gives an upright page. `pdflib.test.ts`: "an EXIF-rotated jpg gives an upright page"
- [x] A PNG with transparency converts. `pdflib.test.ts`: "a png with transparency converts"
- [x] An unknown page size is `INVALID_REQUEST`. `pdflib.test.ts`: "an unknown pageSize is INVALID_REQUEST"
- [x] A PNG converts to PDF and then two PDFs merge, through the whole RPC. `server.test.ts`: "converts png to pdf, then merges two pdfs"

### Merge

- [x] Happy path: 1, 2 and 3 pages merge into 6, in the given order. `merge-pdf.test.ts`: "merges 1 + 2 + 3 pages into 6, in the given order"
- [x] A real job merges a PNG, a PDF and a JPG into "first stem merged.pdf". `merge-pdf.test.ts`: "a real job merges a png, a pdf and a jpg into \"<first stem> merged.pdf\""
- [x] One picture merged with itself gives a two-page PDF (core accepts the same input twice, P59). `merge-pdf.test.ts`: "a real job merges one picture with itself into a two-page pdf"
- [x] The shared combiner contract passes. `merge-pdf.test.ts`: "contract"
- [x] Reversing the inputs reverses the pages. `merge-pdf.test.ts`: "reversing the inputs reverses the pages"
- [x] A single input merges to the same pages. `merge-pdf.test.ts`: "a single input merges to the same pages"
- [x] A corrupt input is `ENGINE_FAILED` and names the file. `merge-pdf.test.ts`: "a corrupt input is ENGINE_FAILED and names the file"
- [x] An encrypted input is `INPUT_ENCRYPTED`. `merge-pdf.test.ts`: "an encrypted input is INPUT_ENCRYPTED"
- [x] An abort between inputs is `CANCELLED` and writes nothing. `merge-pdf.test.ts`: "an abort between inputs is CANCELLED and writes nothing"
- [x] Progress reaches 1 after the last input. `merge-pdf.test.ts`: "progress reaches 1 after the last input"
- [x] In the runner, parts arrive in input order and a PDF is used as it is; one failing input names itself and writes nothing. `runner.test.ts`: "merge: parts reach the combiner in input order, a pdf input is used as it is"; "merge: one failing input fails the job, names that input, and writes nothing"
- [x] The UI: two PDFs offer PDF only as a merge group; merge two rows, reorder, one bar with steps, then one result row; Unmerge returns the rows; Merge is off with fewer than two rows. `ui-core-targets.test.ts`: "two pdfs offer pdf only as a merge group"; `convert.test.tsx`: "merge two rows, reorder, one bar with steps, then one result row", "Unmerge returns the rows", "Merge… is off with fewer than two rows"
- [ ] A very long PDF (1,800 pages) merges without running out of memory, and can be cancelled (only the page folder naming for 1,800 pages is tested)
- [ ] A merge across mixed sources (images and PDFs) works (a PNG, a PDF and a JPG: covered above)
- [ ] Page size differences are kept, not stretched
- [ ] A merge with one failed part reports which part to the UI row

## Windows-specific

- [ ] Sources stay unlocked after the merge (the code turns the pdf-lib file cache off; no test fails without it on Linux)

## Linux-specific

- [ ] A merge of files from different mounted drives works

# Needs manual testing

## Shared across all platforms

- [ ] Open a merged PDF in two or three real viewers: order, sizes and bookmarks look right
- [ ] A scanned PDF with big images merges in a sensible time

## Mac

- [ ] A PDF made by Preview or Pages merges, and the result opens in Preview
