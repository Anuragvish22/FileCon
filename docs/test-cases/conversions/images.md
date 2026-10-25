# Image conversions (sharp)

## Shared across all platforms

- [ ] Every image format pair in [CONVERSIONS](../../CONVERSIONS.md) gives output that parses with the right type and size
- [ ] An animated GIF to AVIF or WebP keeps its frames, or says clearly that it does not
- [ ] A long animated GIF converts and can be cancelled at any time
- [ ] Transparency is kept when the target supports it, and flattened onto a colour (flagged as lossy) when it does not
- [ ] EXIF rotation is applied, so the picture is upright in the output
- [ ] A corrupt or truncated image fails with a clear code and no output file
- [ ] A file with the wrong extension is detected by its content
- [ ] A very large picture (tens of megapixels) converts or fails with a clear memory message, never crashes the app
- [ ] A zero-byte file fails with a clear code
- [ ] A CMYK or 16-bit picture converts with sensible colours
- [ ] The quality option changes the output size in the expected direction
- [ ] Lossy routes are flagged before Convert (for example JPG to PNG is not, PNG to JPG is)

## Windows-specific

- [ ] The source can be deleted or moved right after the job (no file kept open)
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
