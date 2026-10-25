# PDF (pdf-lib and merge)

## Shared across all platforms

- [x] Merge keeps every page in the order given (covered by: `packages/core/test/combiners/merge-pdf.test.ts`)
- [ ] An image list merged to one PDF has one page per image, in order
- [ ] A very long PDF (1,800 pages) merges without running out of memory, and can be cancelled
- [ ] An encrypted PDF fails with a clear code, the others in the batch go on
- [ ] A corrupt PDF fails with a clear code and no output
- [ ] A merge with one failed part reports which part, and writes nothing
- [ ] The merge order can be changed and the output follows it
- [ ] A merge across mixed sources (images and PDFs) works
- [ ] Page size differences are kept, not stretched

## Windows-specific

- [ ] Sources stay unlocked after the merge

## Linux-specific

- [ ] A merge of files from different mounted drives works

# Needs manual testing

## Shared across all platforms

- [ ] Open a merged PDF in two or three real viewers: order, sizes and bookmarks look right
- [ ] A scanned PDF with big images merges in a sensible time

## Mac

- [ ] A PDF made by Preview or Pages merges, and the result opens in Preview
