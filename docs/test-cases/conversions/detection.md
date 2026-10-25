# Detecting what a file is

Test entries read: `file`: "test name". Files are under `packages/*/test/`.

## Shared across all platforms

- [x] Happy path: files are detected by their content (the table of fixtures). `detect.test.ts`: "detect: happy path"
- [x] An old Word/Excel/PowerPoint file has no content format, because every compound file looks alike, so the extension decides. `detect.test.ts`: "doc has no content format, since every CFB looks alike: the extension decides"
- [x] A generic zip with a zip-based extension (docx, odt and so on) is accepted by extension. `detect.test.ts`: "a generic zip with a zip-based extension is accepted by extension"
- [x] A `.jpg` that is really WebP is treated as WebP and flagged. `detect.test.ts`: "a .jpg that is really webp is treated as webp and flagged"
- [x] A compound file with a non-compound extension is unsupported. `detect.test.ts`: "a CFB file with a non-CFB extension is unsupported"
- [x] A zip with a non-zip extension is unsupported. `detect.test.ts`: "a zip with a non-zip-format extension is unsupported"
- [x] Plain text renamed to `.jpg` is unsupported. `detect.test.ts`: "plain text renamed to .jpg is unsupported"
- [x] An `.svg` without `<svg` in its head is unsupported. `detect.test.ts`: "an svg extension without <svg in the head is unsupported"
- [x] A recognised but unsupported content type is unsupported even with a known extension. `detect.test.ts`: "a recognised but unsupported content type is unsupported even with a known extension"
- [x] A binary with no extension is detected by content. `detect.test.ts`: "a binary without an extension is detected by content"
- [x] An empty file is `EMPTY_FILE`. `detect.test.ts`: "an empty file is EMPTY_FILE"
- [x] A missing file is `INPUT_NOT_FOUND`. `detect.test.ts`: "a missing file is INPUT_NOT_FOUND"
- [x] A folder is `INPUT_UNREADABLE`. `detect.test.ts`: "a directory is INPUT_UNREADABLE"
- [x] A symlink to a file is followed. `detect.test.ts`: "a symlink to a file is followed"
- [x] A missing file is a result, not a rejection, and the order is kept. `server.test.ts`: "detect keeps the order, and a missing file is a result, not a rejection"
- [x] Aliases map to the canonical id (jpeg to jpg and so on). `formats.test.ts`: "maps aliases to the canonical id"
- [x] The first extension of a format is its output extension. `formats.test.ts`: "uses the first ext as the output ext"
- [x] Extensions are looked up case-insensitively, with or without the dot. `formats.test.ts`: "looks up exts case-insensitively, with or without the dot"
- [x] Unknown extensions and ids give `null`. `formats.test.ts`: "returns null for unknown exts and ids"
- [x] Ids and extensions are unique and lowercase. `formats.test.ts`: "has unique ids and exts, all lowercase"
- [x] The UI: a detecting path is a detecting row; rows with an error or no format are unsupported and not asked about. `store.test.ts`: "a detecting path is a detecting row"; "files with an error or no format are unsupported and not asked about"
- [x] The UI shows unsupported with a reason and mismatch with what was detected. `convert.test.tsx`: "unsupported: a reason instead of a select"; "mismatch: the row says what was detected"
- [ ] A file with a very long name or a path over the limit is detected or fails with a clear code
- [ ] A truncated file (header only) of each format fails with a clear code, not a crash
- [ ] A huge number of dropped files (10,000) is detected without freezing the app (the expand step stops at 1,000; detection speed is not tested)

## Windows-specific

- [ ] Uppercase extensions (`.JPG`) are recognised (the lookup is case-insensitive in `formats.test.ts`; no detect test with a real `.JPG`)

## Linux-specific

- [ ] A file with no extension is recognised by content (covered above)

## Mac-specific

- [ ] A file whose name has decomposed Unicode letters is detected

# Needs manual testing

## Shared across all platforms

- [ ] A folder of mixed real files from a phone and from office software: every row says the right type
