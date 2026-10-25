# Image conversions (sharp)

Test entries read: `file`: "test name". Files are under `packages/*/test/`.

## Shared across all platforms

- [x] Happy path: every ordered pair of the six image formats keeps the size and gives the right format. `sharp/converter.test.ts`: "%s → %s keeps the size and gives the right format"
- [x] A format to itself re-encodes to the same format. `sharp/converter.test.ts`: "the %s self-edge re-encodes to the same format"
- [x] There is an edge for every pair, self-edges included, and every edge honours at least one option. `sharp/converter.test.ts`: "has an edge for every ordered pair of the six formats, self-edges included"; "every edge honours at least one option"
- [x] The shared converter contract passes (cost, lossy ids, options). `sharp/converter.test.ts`: "contract"
- [x] A corrupt file is `ENGINE_FAILED` and leaves no temp folder. `sharp/converter.test.ts`: "a corrupt file is ENGINE_FAILED and leaves no temp dir"
- [x] A quality of 0 or 101 is `INVALID_REQUEST`. `sharp/converter.test.ts`: "quality %i is INVALID_REQUEST"
- [x] A 20,000 by 10 PNG to WebP is shrunk to fit the WebP limit and says "downscaled". `sharp/converter.test.ts`: "a 20,000 × 10 png → webp fits the webp limit and says \"downscaled\""
- [x] A normal image, and a resize the user asked for, add no note. `sharp/converter.test.ts`: "a normal image has no notes, and neither does a resize the user asked for"
- [x] JPG to JPG at quality 40 is a valid, smaller JPG named "stem (1).jpg". `sharp/converter.test.ts`: "jpg → jpg at quality 40 is a valid, smaller jpg named \"<stem> (1).jpg\""
- [x] Resize fits inside the box, never enlarges, and rejects width 0. `sharp/converter.test.ts`: "resizes to fit, never enlarges, and rejects width 0"
- [x] Grayscale into every format gives a valid image, with one channel. `sharp/converter.test.ts`: "grayscale into %s gives a valid image"; "grayscale output has one channel"
- [x] Metadata is stripped by default and kept with `keepMetadata`. `sharp/converter.test.ts`: "metadata is stripped by default and kept with keepMetadata"
- [x] An EXIF-rotated image comes out upright, with the orientation tag gone. `sharp/converter.test.ts`: "an EXIF-rotated image comes out upright, with the orientation tag gone"
- [x] An unknown TIFF compression is `INVALID_REQUEST`. `sharp/converter.test.ts`: "an unknown tiffCompression is INVALID_REQUEST"
- [x] Transparent pixels become white in a JPG, or the chosen background. `sharp/converter.test.ts`: "transparent pixels become white in a jpg"; "flattens transparent pixels onto the chosen background"
- [x] A malformed background is `INVALID_REQUEST`. `sharp/converter.test.ts`: "a malformed background is INVALID_REQUEST"
- [x] A PNG converts to JPG with sharp through the whole RPC. `server.test.ts`: "converts png to jpg with sharp, and relays the job updates"
- [ ] An animated GIF to AVIF or WebP keeps its frames, or says clearly that it does not
- [ ] A long animated GIF converts and can be cancelled at any time
- [ ] A very large picture (tens of megapixels) converts or fails with a clear memory message, never crashes the app
- [ ] A zero-byte file fails with a clear code (detection covers it: see detection.md)
- [ ] A CMYK or 16-bit picture converts with sensible colours
- [ ] A file with the wrong extension converts by its real content (detection is tested; the conversion after it is not)
- [ ] Lossy routes are flagged before Convert (for example PNG to JPG is, JPG to PNG is not)

## Windows-specific

- [ ] The source can be deleted or moved right after the job (the code sets `cache({ files: 0 })`; no test fails without it on Linux)
- [ ] A source with non-ASCII letters in its path converts

## Linux-specific

- [ ] A source on a mounted Windows drive (`/mnt/c`) converts

## Mac-specific

- [ ] A HEIC photo from an iPhone is read, or is clearly reported as unsupported

# Needs manual testing

## Shared across all platforms

- [ ] Open the outputs of every format pair in a real viewer: colours, orientation and transparency look right
- [ ] Photos straight from a phone and a camera (large, rotated, with GPS data) convert correctly
- [ ] A 100-megapixel panorama does not freeze the computer

## Windows

- [ ] Output opens in Photos and in Paint

## Mac

- [ ] Output opens in Preview, and a HEIC file from a real iPhone behaves as described above
