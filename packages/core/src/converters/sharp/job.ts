import { join } from 'node:path';
import sharp from 'sharp';
import { CoreFailure } from '../../errors.ts';
import type { ConvertOptions, Format, StepRequest } from '../../types/index.ts';

// The pixel work of the sharp converter. It runs in a child process (worker.ts), because libvips can't
// be interrupted and a killed process is the only way a cancel stops the CPU use.
const FIRST_FLIPPED_ORIENTATION = 5; // EXIF 5 to 8 turn the image a quarter, so width and height swap
const DEFAULT_QUALITY = 90;
const DEFAULT_TIFF_COMPRESSION = 'lzw';
const DEFAULT_BACKGROUND = '#ffffff';
const GRAY_COLOURSPACE = 'b-w';
const DOWNSCALED = 'downscaled';

// Largest side each encoder accepts, measured against sharp 0.35 (the docs' 65,535 for jpeg is not the real limit).
const JPEG_LIMIT = 65500;
const PIXEL_LIMITS: Readonly<Partial<Record<Format, number>>> = {
  jpg: JPEG_LIMIT,
  gif: 65535,
  webp: 16383,
  avif: 16384,
};

interface Size {
  width: number;
  height: number;
}

/** Fit inside the box, aspect kept, never enlarged: what sharp's `fit: inside` with `withoutEnlargement` gives. */
const fitInside = (size: Size, box: { width?: number; height?: number }): Size => {
  const scale = Math.min(
    1,
    box.width === undefined ? 1 : box.width / size.width,
    box.height === undefined ? 1 : box.height / size.height,
  );
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
};

const limitFor = (to: Format, options: ConvertOptions): number | undefined =>
  to === 'tiff' && options.tiffCompression === 'jpeg' ? JPEG_LIMIT : PIXEL_LIMITS[to];

/** Converts one image and returns the notes to show on the done row. */
export const convertImage = async (req: StepRequest): Promise<string[]> => {
  sharp.cache({ files: 0 }); // sharp's file cache keeps images open, which on Windows locks the source and the temp dir (EBUSY)
  const notes: string[] = [];
  const note = (id: string): void => void notes.push(id);
  const { options } = req;
  const source = sharp(req.input);
  const meta = await source.metadata();
  const flipped = (meta.orientation ?? 0) >= FIRST_FLIPPED_ORIENTATION;
  const upright: Size = {
    width: (flipped ? meta.height : meta.width) ?? 0,
    height: (flipped ? meta.width : meta.height) ?? 0,
  };

  const wanted = { width: options.width, height: options.height };
  const limit = limitFor(req.to, options);
  const capped = {
    width: Math.min(options.width ?? Infinity, limit ?? Infinity),
    height: Math.min(options.height ?? Infinity, limit ?? Infinity),
  };
  const box = {
    width: Number.isFinite(capped.width) ? capped.width : undefined,
    height: Number.isFinite(capped.height) ? capped.height : undefined,
  };
  // The note is for a shrink the user didn't ask for: the target format couldn't hold the size.
  const forced = fitInside(upright, box);
  const asked = fitInside(upright, wanted);
  if (forced.width !== asked.width || forced.height !== asked.height) note(DOWNSCALED);

  let pipeline = source.autoOrient();
  // grayscale() alone keeps three channels; b-w makes real single-channel output.
  if (options.grayscale === true) pipeline = pipeline.grayscale().toColourspace(GRAY_COLOURSPACE);
  if (box.width !== undefined || box.height !== undefined)
    pipeline = pipeline.resize({ ...box, fit: 'inside', withoutEnlargement: true });
  // Metadata is stripped by default; the ICC profile always stays, and keepMetadata keeps everything.
  pipeline = options.keepMetadata === true ? pipeline.keepMetadata() : pipeline.keepIccProfile();

  const quality = options.quality ?? DEFAULT_QUALITY;
  switch (req.to) {
    case 'jpg':
      // jpeg has no transparency: flatten onto the chosen background (white by default). Only when there is some,
      // since flatten turns a grayscale image back into three channels.
      if (meta.hasAlpha === true)
        pipeline = pipeline.flatten({ background: options.background ?? DEFAULT_BACKGROUND });
      pipeline = pipeline.jpeg({ quality });
      break;
    case 'png':
      pipeline = pipeline.png();
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality });
      break;
    case 'tiff':
      pipeline = pipeline.tiff({
        compression: options.tiffCompression ?? DEFAULT_TIFF_COMPRESSION,
        quality,
      });
      break;
    case 'gif':
      pipeline = pipeline.gif();
      break;
    default:
      throw new CoreFailure('ENGINE_FAILED', { engine: 'sharp' }, `no encoder for ${req.to}`);
  }

  await pipeline.toFile(join(req.outDir, `${req.baseName}.${req.to}`));
  return notes;
};
