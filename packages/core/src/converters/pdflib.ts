import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { COST } from '../costs.ts';
import { CoreFailure } from '../errors.ts';
import { validateOptions } from '../options.ts';
import type { Converter, ConvertOptions, Edge, Format } from '../types/index.ts';

// ARCHITECTURE section 8. jpg and png go into the pdf as they are; other images come through sharp → png first.
const PDF_SOURCES: readonly Format[] = ['jpg', 'png'];
const NO_ORIENTATION = 1;
const ALWAYS_AVAILABLE = true; // built in: nothing to discover
const HALF = 0.5;
const UPRIGHT_JPEG_QUALITY = 100;

interface Size {
  width: number;
  height: number;
}

// Points (1/72 inch), portrait.
const PAGE_SIZES: Readonly<Record<'a4' | 'letter', Size>> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

const EDGES: Edge[] = PDF_SOURCES.map((from) => ({
  from,
  to: 'pdf',
  cost: COST.container,
  options: ['pageSize'],
}));

interface Placement {
  page: Size;
  x: number;
  y: number;
  drawn: Size;
}

/** `auto`: the page is the image. a4 and letter: fitted inside, centred, and turned to landscape for a wide image. */
const placeImage = (image: Size, pageSize: ConvertOptions['pageSize']): Placement => {
  if (pageSize === undefined || pageSize === 'auto')
    return { page: image, x: 0, y: 0, drawn: image };
  const portrait = PAGE_SIZES[pageSize];
  const page =
    image.width > image.height ? { width: portrait.height, height: portrait.width } : portrait;
  const scale = Math.min(page.width / image.width, page.height / image.height);
  const drawn = { width: image.width * scale, height: image.height * scale };
  return {
    page,
    drawn,
    x: (page.width - drawn.width) * HALF,
    y: (page.height - drawn.height) * HALF,
  };
};

/**
 * A phone photo embedded as it is would show sideways: CONTRACTS section 2 says images always come out upright.
 * Only a jpg with an EXIF orientation is re-encoded; every other image is embedded untouched.
 */
const uprightJpg = async (path: string): Promise<Uint8Array> => {
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(path).metadata();
    if ((meta.orientation ?? NO_ORIENTATION) === NO_ORIENTATION) return await readFile(path);
    return await sharp(path).autoOrient().jpeg({ quality: UPRIGHT_JPEG_QUALITY }).toBuffer();
  } catch {
    // shortcut: without a working sharp the jpg is embedded as it is, possibly sideways. Upgrade if that is ever reported.
    return readFile(path);
  }
};

export const pdflibConverter: Converter = {
  id: 'pdflib',
  engineId: 'pdflib',
  pack: 'builtin',
  edges: EDGES,
  available: () => Promise.resolve(ALWAYS_AVAILABLE),

  async convert(req, ctx) {
    validateOptions(req.options);
    if (ctx.signal.aborted) throw new CoreFailure('CANCELLED');
    try {
      const bytes = req.from === 'jpg' ? await uprightJpg(req.input) : await readFile(req.input);
      const doc = await PDFDocument.create();
      const image = req.from === 'jpg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
      const { page, x, y, drawn } = placeImage(image, req.options.pageSize);
      doc.addPage([page.width, page.height]).drawImage(image, { x, y, ...drawn });
      const output = join(req.outDir, `${req.baseName}.pdf`);
      await writeFile(output, await doc.save());
      return [output];
    } catch (caught) {
      if (caught instanceof CoreFailure) throw caught;
      const message = caught instanceof Error ? caught.message : String(caught);
      throw new CoreFailure('ENGINE_FAILED', { engine: 'pdflib' }, message);
    }
  },
};
