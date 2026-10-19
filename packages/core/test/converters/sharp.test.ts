import { readFile, stat, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { basename, join } from 'node:path';
import { fileTypeFromFile } from 'file-type';
import sharp, { type FormatEnum, type Sharp } from 'sharp';
import { describe, expect, it } from 'vitest';
import { sharpConverter } from '../../src/converters/sharp.ts';
import { canonical } from '../../src/formats.ts';
import type { ConvertOptions, Format, JobCtx, StepRequest } from '../../src/types/index.ts';
import { runConverterContract } from '../contract.ts';
import { expectNoTmp, fixture, harness, useWorkDir, workDirPath, writeSource } from '../harness.ts';

const SMALL = { width: 64, height: 32 };
const NOISE_SIZE = { width: 400, height: 300 };
const WIDE = { width: 20000, height: 10 };
const WEBP_LIMIT = 16383;
const LOW_QUALITY = 40;
const TRUNCATED_BYTES = 64;
const IMAGE_FORMATS: Format[] = ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif'];
const GPS_IFD_POINTER = Buffer.from([0x25, 0x88]); // tag 0x8825 in little-endian TIFF/EXIF
const TIFF_COMPRESSION_TAG = 259;
const TIFF_ENTRY_BYTES = 12;
const TIFF_COMPRESSION_CODES: Record<string, number[]> = {
  none: [1],
  lzw: [5],
  jpeg: [6, 7],
  deflate: [8, 32946],
};

const ctxOf = (notes: string[] = []): JobCtx => ({
  signal: new AbortController().signal,
  tmpDir: workDirPath(),
  onProgress: () => undefined,
  note: (id) => notes.push(id),
});

/** An image of the given format and size, written as an input file. */
const makeInput = async (
  format: Format,
  size = SMALL,
  prepare: (image: Sharp) => Sharp = (image) => image,
): Promise<string> => {
  const base = sharp({ create: { ...size, channels: 3, background: '#3366cc' } });
  const encoded = prepare(base);
  const buffer = await (
    format === 'jpg'
      ? encoded.jpeg()
      : format === 'tiff'
        ? encoded.tiff()
        : encoded.toFormat(format as keyof FormatEnum)
  ).toBuffer();
  return writeSource(`input.${format}`, buffer);
};

let counter = 0;
const convertTo = async (
  input: string,
  from: Format,
  to: Format,
  options: ConvertOptions = {},
  notes: string[] = [],
): Promise<string> => {
  counter += 1;
  const outDir = join(workDirPath(), `sharp-out-${counter}`);
  await (await import('node:fs/promises')).mkdir(outDir, { recursive: true });
  const request: StepRequest = { input, from, to, outDir, baseName: 'out', options };
  const [output] = await sharpConverter.convert(request, ctxOf(notes));
  return output ?? '';
};

const sizeOf = async (path: string): Promise<{ width: number; height: number }> => {
  const meta = await sharp(path).metadata();
  return { width: meta.width, height: meta.height };
};

/** Reads the Compression tag (259) of the first image in a TIFF file. */
const tiffCompressionOf = (buffer: Buffer): number => {
  const little = buffer.toString('latin1', 0, 2) === 'II';
  const read16 = (at: number): number =>
    little ? buffer.readUInt16LE(at) : buffer.readUInt16BE(at);
  const read32 = (at: number): number =>
    little ? buffer.readUInt32LE(at) : buffer.readUInt32BE(at);
  const ifd = read32(4);
  const entries = read16(ifd);
  for (let index = 0; index < entries; index += 1) {
    const entry = ifd + 2 + index * TIFF_ENTRY_BYTES;
    if (read16(entry) === TIFF_COMPRESSION_TAG) return read16(entry + 8);
  }
  throw new Error('no Compression tag');
};

useWorkDir();

describe.skipIf(!(await sharpConverter.available()))('sharp converter', () => {
  describe('happy path', () => {
    const pairs = IMAGE_FORMATS.flatMap((from) =>
      IMAGE_FORMATS.filter((to) => to !== from).map((to) => [from, to] as const),
    );
    it.each(pairs)('%s → %s keeps the size and gives the right format', async (from, to) => {
      const output = await convertTo(await makeInput(from), from, to);
      expect(canonical((await fileTypeFromFile(output))?.ext ?? '')).toBe(to);
      expect(await sizeOf(output)).toEqual(SMALL);
    });

    it.each(IMAGE_FORMATS)('the %s self-edge re-encodes to the same format', async (format) => {
      const output = await convertTo(await makeInput(format), format, format, { width: 32 });
      expect(canonical((await fileTypeFromFile(output))?.ext ?? '')).toBe(format);
      expect(await sizeOf(output)).toEqual({ width: 32, height: 16 });
    });
  });

  describe('edges', () => {
    it('has an edge for every ordered pair of the six formats, self-edges included', () => {
      expect(sharpConverter.edges).toHaveLength(IMAGE_FORMATS.length ** 2);
    });

    it('every edge honours at least one option', () => {
      for (const edge of sharpConverter.edges) expect(edge.options?.length).toBeGreaterThan(0);
    });
  });

  describe('contract', () => {
    for (const [from, to, folder, name] of [
      ['jpg', 'png', 'jpg', 'sample.jpg'],
      ['png', 'webp', 'png', 'sample.png'],
      ['png', 'png', 'png', 'sample.png'],
    ] as const)
      runConverterContract({
        converter: sharpConverter,
        from,
        to,
        fixture: fixture(folder, name),
      });
  });

  describe('must also pass', () => {
    it('a corrupt file is ENGINE_FAILED and leaves no temp dir', async () => {
      const { submitOne } = await harness({ converters: [sharpConverter] });
      const whole = await readFile(fixture('png', 'sample.png'));
      const input = await writeSource('broken.png', whole.subarray(0, TRUNCATED_BYTES));
      const job = await submitOne({ kind: 'convert', input, target: 'jpg', options: {} });
      expect(job.error).toMatchObject({ code: 'ENGINE_FAILED', params: { engine: 'sharp' } });
      await expectNoTmp(job);
    });

    it.each([0, 101])('quality %i is INVALID_REQUEST', async (quality) => {
      const input = await makeInput('png');
      await expect(convertTo(input, 'png', 'jpg', { quality })).rejects.toMatchObject({
        error: { code: 'INVALID_REQUEST', params: { what: 'quality-range' } },
      });
    });

    it('a 20,000 × 10 png → webp fits the webp limit and says "downscaled"', async () => {
      const { submitOne } = await harness({ converters: [sharpConverter] });
      const input = await makeInput('png', WIDE);
      const job = await submitOne({ kind: 'convert', input, target: 'webp', options: {} });
      expect(job.state).toBe('done');
      expect(job.notes).toEqual(['downscaled']);
      expect((await sizeOf(job.outputs[0] ?? '')).width).toBeLessThanOrEqual(WEBP_LIMIT);
    });

    it('a normal image has no notes, and neither does a resize the user asked for', async () => {
      const notes: string[] = [];
      await convertTo(await makeInput('png'), 'png', 'webp', {}, notes);
      await convertTo(await makeInput('png', WIDE), 'png', 'webp', { width: 100 }, notes);
      expect(notes).toEqual([]);
    });

    it('jpg → jpg at quality 40 is a valid, smaller jpg named "<stem> (1).jpg"', async () => {
      const { submitOne, outDir } = await harness({ converters: [sharpConverter] });
      const photo = join(outDir, 'photo.jpg');
      await sharp(randomBytes(NOISE_SIZE.width * NOISE_SIZE.height * 3), {
        raw: { ...NOISE_SIZE, channels: 3 },
      })
        .jpeg({ quality: 95 })
        .toFile(photo);
      const job = await submitOne({
        kind: 'convert',
        input: photo,
        target: 'jpg',
        options: { quality: LOW_QUALITY },
      });
      expect(job.outputs).toEqual([join(outDir, 'photo (1).jpg')]);
      expect((await stat(job.outputs[0] ?? '')).size).toBeLessThan((await stat(photo)).size);
      expect((await fileTypeFromFile(job.outputs[0] ?? ''))?.ext).toBe('jpg');
    });

    it('resizes to fit, never enlarges, and rejects width 0', async () => {
      const input = await makeInput('png', { width: 400, height: 200 });
      expect(await sizeOf(await convertTo(input, 'png', 'png', { width: 100 }))).toEqual({
        width: 100,
        height: 50,
      });
      expect(await sizeOf(await convertTo(input, 'png', 'png', { width: 1000 }))).toEqual({
        width: 400,
        height: 200,
      });
      await expect(convertTo(input, 'png', 'png', { width: 0 })).rejects.toMatchObject({
        error: { code: 'INVALID_REQUEST', params: { what: 'width-range' } },
      });
    });

    it.each(IMAGE_FORMATS)('grayscale into %s gives a valid image', async (to) => {
      const output = await convertTo(await makeInput('png'), 'png', to, { grayscale: true });
      expect(canonical((await fileTypeFromFile(output))?.ext ?? '')).toBe(to);
      expect(await sizeOf(output)).toEqual(SMALL);
    });

    it('grayscale output has one channel', async () => {
      const output = await convertTo(await makeInput('png'), 'png', 'jpg', { grayscale: true });
      const meta = await sharp(output).metadata();
      expect(meta.channels === 1 || meta.space === 'b-w').toBe(true);
    });

    it('metadata is stripped by default and kept with keepMetadata', async () => {
      const withGps = (image: Sharp): Sharp =>
        image.withExif({
          IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '51/1 30/1 0/1' },
        });
      const input = await makeInput('jpg', SMALL, withGps);
      expect((await sharp(input).metadata()).exif).toBeDefined();

      const stripped = await convertTo(input, 'jpg', 'jpg');
      expect((await sharp(stripped).metadata()).exif).toBeUndefined();

      const kept = await convertTo(input, 'jpg', 'jpg', { keepMetadata: true });
      const exif = (await sharp(kept).metadata()).exif;
      expect(exif?.includes(GPS_IFD_POINTER)).toBe(true);
    });

    it('an EXIF-rotated image comes out upright, with the orientation tag gone', async () => {
      const input = await makeInput('jpg', { width: 40, height: 20 }, (image) =>
        image.withMetadata({ orientation: 6 }),
      );
      const output = await convertTo(input, 'jpg', 'jpg');
      const meta = await sharp(output).metadata();
      expect({ width: meta.width, height: meta.height }).toEqual({ width: 20, height: 40 });
      expect(meta.orientation ?? 1).toBe(1);
    });

    it.each(Object.keys(TIFF_COMPRESSION_CODES))('tiffCompression %s is used', async (name) => {
      const options = { tiffCompression: name } as ConvertOptions;
      const output = await convertTo(await makeInput('png'), 'png', 'tiff', options);
      expect(TIFF_COMPRESSION_CODES[name]).toContain(tiffCompressionOf(await readFile(output)));
    });

    it('an unknown tiffCompression is INVALID_REQUEST', async () => {
      const options = { tiffCompression: 'zip' } as unknown as ConvertOptions;
      await expect(convertTo(await makeInput('png'), 'png', 'tiff', options)).rejects.toMatchObject(
        { error: { params: { what: 'tiff-compression-value' } } },
      );
    });

    it('transparent pixels become white in a jpg', async () => {
      const input = await writeSource(
        'clear.png',
        await sharp({
          create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
        })
          .png()
          .toBuffer(),
      );
      const output = await convertTo(input, 'png', 'jpg');
      const { data } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
      expect(data[0]).toBeGreaterThan(240);
    });

    it('a source name is only used for the output stem', async () => {
      const output = await convertTo(await makeInput('png'), 'png', 'jpg');
      expect(basename(output)).toBe('out.jpg');
      await writeFile(join(workDirPath(), 'touch'), '');
    });
  });
});
