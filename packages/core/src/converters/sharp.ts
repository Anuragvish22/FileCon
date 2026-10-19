import { join } from 'node:path';
import { COST } from '../costs.ts';
import { CoreFailure } from '../errors.ts';
import { validateOptions } from '../options.ts';
import type { Converter, ConvertOptions, Edge, Format, OptionKey } from '../types/index.ts';

// ARCHITECTURE section 8. jpg, png, webp, avif, tiff and gif, between each other.
const IMAGE_FORMATS: readonly Format[] = ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif'];
const LOSSY_TARGETS: readonly Format[] = ['jpg', 'webp', 'avif', 'gif'];
const QUALITY_TARGETS: readonly Format[] = ['jpg', 'webp', 'avif'];
const REENCODED = 'reencoded';
const DOWNSCALED = 'downscaled';
const DEFAULT_QUALITY = 90;
const DEFAULT_TIFF_COMPRESSION = 'lzw';
const WHITE = '#ffffff';
const GRAY_COLOURSPACE = 'b-w';
const FIRST_FLIPPED_ORIENTATION = 5; // EXIF 5 to 8 turn the image a quarter, so width and height swap

// Largest side each encoder accepts, measured against sharp 0.35 (the docs' 65,535 for jpeg is not the real limit).
const JPEG_LIMIT = 65500;
const PIXEL_LIMITS: Readonly<Partial<Record<Format, number>>> = {
  jpg: JPEG_LIMIT,
  gif: 65535,
  webp: 16383,
  avif: 16384,
};

const edgeOptions = (to: Format): OptionKey[] => [
  'width',
  'height',
  'grayscale',
  'keepMetadata',
  ...(QUALITY_TARGETS.includes(to) ? (['quality'] as const) : []),
  ...(to === 'tiff' ? (['tiffCompression'] as const) : []),
];

const edgeOf = (from: Format, to: Format): Edge => {
  // Self-edges re-encode at another quality (jpg, webp, avif) or only resize and recolor (png, tiff, gif).
  const lossy = from === to ? QUALITY_TARGETS.includes(to) : LOSSY_TARGETS.includes(to);
  return {
    from,
    to,
    cost: lossy ? COST.lossyReencode : COST.losslessReencode,
    ...(lossy ? { lossy: REENCODED } : {}),
    options: edgeOptions(to),
  };
};

const EDGES: Edge[] = IMAGE_FORMATS.flatMap((from) => IMAGE_FORMATS.map((to) => edgeOf(from, to)));

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

type SharpModule = typeof import('sharp');
let loading: Promise<SharpModule['default']> | undefined;
// Loaded on first use, so a missing or broken native binary shows as "not available" instead of crashing the host.
const loadSharp = (): Promise<SharpModule['default']> =>
  (loading ??= import('sharp').then((module) => module.default));

export const sharpConverter: Converter = {
  id: 'sharp',
  engineId: 'sharp',
  pack: 'builtin',
  edges: EDGES,
  // shortcut: no maxConcurrent, libvips manages its own threads; add one if parallel image jobs starve the machine.

  available: () =>
    loadSharp().then(
      () => true,
      () => false,
    ),

  async convert(req, ctx) {
    validateOptions(req.options);
    // sharp can't be interrupted mid-operation, so this is the only place the signal is checked.
    if (ctx.signal.aborted) throw new CoreFailure('CANCELLED');
    const { options } = req;
    try {
      const sharp = await loadSharp();
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
      if (forced.width !== asked.width || forced.height !== asked.height) ctx.note(DOWNSCALED);

      let pipeline = source.autoOrient();
      // grayscale() alone keeps three channels; b-w makes real single-channel output.
      if (options.grayscale === true)
        pipeline = pipeline.grayscale().toColourspace(GRAY_COLOURSPACE);
      if (box.width !== undefined || box.height !== undefined)
        pipeline = pipeline.resize({ ...box, fit: 'inside', withoutEnlargement: true });
      // Metadata is stripped by default; the ICC profile always stays, and keepMetadata keeps everything.
      pipeline =
        options.keepMetadata === true ? pipeline.keepMetadata() : pipeline.keepIccProfile();

      const quality = options.quality ?? DEFAULT_QUALITY;
      switch (req.to) {
        case 'jpg':
          // jpeg has no transparency: flatten onto white rather than black. Only when there is some,
          // since flatten turns a grayscale image back into three channels.
          if (meta.hasAlpha === true) pipeline = pipeline.flatten({ background: WHITE });
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

      const output = join(req.outDir, `${req.baseName}.${req.to}`);
      await pipeline.toFile(output);
      return [output];
    } catch (caught) {
      if (caught instanceof CoreFailure) throw caught;
      const message = caught instanceof Error ? caught.message : String(caught);
      throw new CoreFailure('ENGINE_FAILED', { engine: 'sharp' }, message);
    }
  },
};
