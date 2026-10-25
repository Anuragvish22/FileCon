# Output saving

Test entries read: `file`: "test name". Files are under `packages/*/test/`.

## Shared across all platforms

### One file

- [x] Happy path: saved under the plain name when there is no conflict, and the temp file is removed. `output.test.ts`: "saves under the plain name when there is no conflict, and removes the temp file"
- [x] A taken name gets a number, and the existing file is never touched. `output.test.ts`: "numbers the name on conflict and never touches the existing file"
- [x] Two commits of the same name at the same moment get different names. `output.test.ts`: "two concurrent commits of the same stem get distinct names"
- [x] A source already in the output folder is never the destination. `output.test.ts`: "a source that is already in the output dir is never the destination"
- [x] The output on another drive is copied (EXDEV). `output.test.ts`: "copies when the output is on another device (EXDEV)"
- [x] Where hard links are not supported at all (FAT), the file is copied and renamed. `output.test.ts`: "copies and renames when hard links are not supported at all (FAT)"
- [x] The no-link fallback still never replaces an existing file. `output.test.ts`: "the no-link fallback still never replaces an existing file"
- [x] A full disk is `DISK_FULL` and leaves no part file. `output.test.ts`: "a full disk is DISK_FULL, and no part file is left"; also `failures.test.ts`: row "the disk is full (ENOSPC) while a step writes"
- [x] Any other write failure is `OUTPUT_WRITE_FAILED` with the cause as detail. `output.test.ts`: "any other write failure is OUTPUT_WRITE_FAILED with the cause as detail"
- [x] After 999 numbered names it gives up with `OUTPUT_WRITE_FAILED`, trying exactly (1) to (999). `output.test.ts`: "gives up after 999 numbered names with OUTPUT_WRITE_FAILED" and "tries exactly names (1) to (999) before giving up"
- [x] A name reserved during a commit is freed after success and after failure. `output.test.ts`: "frees its name reservation after success and after failure"
- [x] An unsafe name is cleaned so a name can never leave the output folder. `output.test.ts`: "cleans an unsafe stem, so a name can never leave the output dir"
- [x] A read-only output folder fails as `OUTPUT_DIR_NOT_WRITABLE` with nothing half written. `failures.test.ts`: row "the output folder is read-only" (skipped when run as root)

### Names

- [x] Characters that FAT and Windows reject are replaced. `output.test.ts`: "safeStem" › "replaces characters FAT and Windows reject"
- [x] Trailing dots and spaces are trimmed. `output.test.ts`: "trims trailing dots and spaces"
- [x] Windows reserved names, with or without an extension, in any case, are marked. `output.test.ts`: "marks Windows reserved names, with or without an extension, in any case"
- [x] A long name is cut to 200 bytes without breaking a character. `output.test.ts`: "cuts to 200 bytes without breaking a character"
- [x] An empty result becomes "file". `output.test.ts`: "turns an empty result into \"file\""
- [x] A source name is only used for the output's stem. `sharp.test.ts`: "a source name is only used for the output stem"
- [x] The output is named after the input, and nothing is left under LibreOffice's own name. `libreoffice.test.ts`: "names the output after baseName, and leaves nothing under soffice's own name"
- [x] A merge is named "first stem merged.pdf". `merge-pdf.test.ts`: "a real job merges a png, a pdf and a jpg into \"<first stem> merged.pdf\""

### Many outputs (page folders)

- [x] A folder is named "stem (ext)" and page numbers pad to at least 3 digits. `output.test.ts`: "commitFolder" › "creates \"<stem> (<ext>)\" and pads page numbers to at least 3"
- [x] A 1,800-page book: width 4, in order. `output.test.ts`: "handles a 1,800-page book: width 4, in order"
- [x] A page range keeps the real page numbers. `output.test.ts`: "keeps real page numbers for a page range"
- [x] A folder name that is taken gets (1), and the existing folder is left alone. `output.test.ts`: "a folder name that is taken gets (1), and the existing folder is left alone"
- [x] The names an extractor gave, and its own extensions, are kept. `output.test.ts`: "keeps the names an extractor gave, and its own extensions"
- [x] Two files with the same name are named by position. `output.test.ts`: "names files by position when two of them share a name"
- [x] If a file fails midway, what was created is removed and the temp files stay. `output.test.ts`: "removes what it created when a file fails midway, and keeps the temp files"
- [x] Rollback never deletes a folder it did not create. `output.test.ts`: "rollback never deletes a folder it did not create"
- [x] It works across drives too. `output.test.ts`: "works across devices too (EXDEV on every link)"
- [x] The source's bytes, size and modified time are the same after commits that fall back to copying. `output.test.ts`: "the source file is never changed" › "its bytes, size and mtime are the same after commits that fall back to copying"

### Still to test

- [ ] Two jobs finishing at once with the same name in the real runner get two different names
- [ ] An output folder deleted during the job fails with a clear code
- [ ] A name with spaces, dots, non-ASCII letters or emoji is kept as it is
- [ ] The output folder chosen next to the source, or elsewhere, is used as chosen
- [ ] Fan-out reports which output failed (the folder case is covered, the report to the UI is not)

## Windows-specific

- [ ] Names that differ only by case count as the same name
- [ ] A path over 260 characters works or fails clearly
- [ ] Hard links are not available on the target drive (FAT/exFAT): the copy fallback is tested with a fake, not on a real FAT drive

## Linux-specific

- [ ] A destination on a real second filesystem (a mounted drive) commits without overwriting (tested with a fake EXDEV)

## Mac-specific

- [ ] Names are compared the way the filesystem does (case-insensitive, normalised letters)

# Needs manual testing

## Shared across all platforms

- [ ] Save to a USB stick and pull it out in the middle of a job: a clear failure, no half file left on the stick
- [ ] Save to a cloud-synced folder (OneDrive, Dropbox, iCloud Drive): the output appears once and is not duplicated
- [ ] Save to a real network share

## Windows

- [ ] A destination on a FAT or exFAT drive works

## Mac

- [ ] A destination on an external exFAT drive works
