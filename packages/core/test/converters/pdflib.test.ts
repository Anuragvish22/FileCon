import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileTypeFromFile } from 'file-type';
import sharp, { type Sharp } from 'sharp';
import { describe, expect, it } from 'vitest';
import { pdflibConverter } from '../../src/converters/pdflib.ts';
import { sharpConverter } from '../../src/converters/sharp/converter.ts';
import { buildGraph, route } from '../../src/graph/index.ts';
import type { ConvertOptions, Format, JobCtx } from '../../src/types/index.ts';
import { runConverterContract } from '../contract.ts';
import { registryOf, stepsOf } from '../fakes.ts';
import { expectNoTmp, fixture, harness, useWorkDir, workDirPath, writeSource } from '../harness.ts';
import { pageSizes } from '../pdfs.ts';

const WIDE = { width: 60, height: 40 };
const TALL = { width: 40, height: 60 };
const A4 = { width: 595.28, height: 841.89 };
const LETTER = { width: 612, height: 792 };
const TRUNCATED_BYTES = 40;

const ctx: JobCtx = {
  signal: new AbortController().signal,
  tmpDir: workDirPath(),
  onProgress: () => undefined,
  note: () => undefined,
};

let counter = 0;
const convertToPdf = async (
  input: string,
  from: Format,
  options: ConvertOptions = {},
): Promise<string> => {
  counter += 1;
  const outDir = join(workDirPath(), `pdflib-out-${counter}`);
  await mkdir(outDir, { recursive: true });
  const [output] = await pdflibConverter.convert(
    { input, from, to: 'pdf', outDir, baseName: 'out', options },
    ctx,
  );
  return output ?? '';
};

const imageFile = async (
  format: 'jpg' | 'png',
  size: { width: number; height: number },
  channels: 3 | 4 = 3,
  prepare: (image: Sharp) => Sharp = (image) => image,
): Promise<string> => {
  const base = sharp({
    create: { ...size, channels, background: { r: 51, g: 102, b: 204, alpha: 0.5 } },
  });
  const encoded = prepare(base);
  return writeSource(
    `image.${format}`,
    await (format === 'jpg' ? encoded.jpeg() : encoded.png()).toBuffer(),
  );
};

useWorkDir();

describe('pdflib converter', () => {
  describe('happy path', () => {
    it.each(['jpg', 'png'] as const)(
      '%s → pdf is one page the size of the image',
      async (format) => {
        const output = await convertToPdf(await imageFile(format, WIDE), format);
        expect((await fileTypeFromFile(output))?.ext).toBe('pdf');
        const [page, ...rest] = await pageSizes(output);
        expect(rest).toEqual([]);
        expect(page?.width).toBeCloseTo(WIDE.width);
        expect(page?.height).toBeCloseTo(WIDE.height);
      },
    );

    it.each([
      ['a4', TALL, A4],
      ['a4', WIDE, { width: A4.height, height: A4.width }],
      ['letter', TALL, LETTER],
      ['letter', WIDE, { width: LETTER.height, height: LETTER.width }],
    ] as const)(
      'pageSize %s gives that page, turned to suit the image',
      async (pageSize, image, page) => {
        const output = await convertToPdf(await imageFile('png', image), 'png', { pageSize });
        const [size] = await pageSizes(output);
        expect(size?.width).toBeCloseTo(page.width);
        expect(size?.height).toBeCloseTo(page.height);
      },
    );
  });

  describe('edges', () => {
    it('jpg and png → pdf are cost 1 and not lossy, and honour pageSize', () => {
      expect(pdflibConverter.edges.map((edge) => [edge.from, edge.to, edge.cost])).toEqual([
        ['jpg', 'pdf', 1],
        ['png', 'pdf', 1],
      ]);
      for (const edge of pdflibConverter.edges) {
        expect(edge.lossy).toBeUndefined();
        expect(edge.options).toEqual(['pageSize']);
      }
    });

    it('a webp reaches pdf through sharp and png, at cost 3', () => {
      const registry = registryOf(sharpConverter, pdflibConverter);
      const graph = buildGraph({
        registry,
        availableIds: new Set(['sharp', 'pdflib']),
        priority: [],
      });
      const found = route(graph, 'webp', 'pdf');
      expect(stepsOf(found)).toEqual(['sharp:webp>png', 'pdflib:png>pdf']);
      expect(found?.hops).toBe(2);
    });
  });

  describe('contract', () => {
    for (const [from, folder, name] of [
      ['jpg', 'jpg', 'sample.jpg'],
      ['png', 'png', 'sample.png'],
    ] as const)
      runConverterContract({
        converter: pdflibConverter,
        from,
        to: 'pdf',
        fixture: fixture(folder, name),
      });
  });

  describe('must also pass', () => {
    it('a corrupt jpg is ENGINE_FAILED and leaves no temp dir', async () => {
      const whole = await readFile(fixture('jpg', 'sample.jpg'));
      const input = await writeSource('broken.jpg', whole.subarray(0, TRUNCATED_BYTES));
      const { submitOne } = await harness({ converters: [pdflibConverter] });
      const job = await submitOne({ kind: 'convert', input, target: 'pdf', options: {} });
      expect(job.error).toMatchObject({ code: 'ENGINE_FAILED', params: { engine: 'pdflib' } });
      await expectNoTmp(job);
    });

    it('an EXIF-rotated jpg gives an upright page', async () => {
      const input = await imageFile('jpg', { width: 40, height: 20 }, 3, (image) =>
        image.withMetadata({ orientation: 6 }),
      );
      const [page] = await pageSizes(await convertToPdf(input, 'jpg'));
      expect(page?.width).toBeCloseTo(20);
      expect(page?.height).toBeCloseTo(40);
    });

    it('a png with transparency converts', async () => {
      const output = await convertToPdf(await imageFile('png', WIDE, 4), 'png');
      expect(await pageSizes(output)).toHaveLength(1);
    });

    it('an unknown pageSize is INVALID_REQUEST', async () => {
      const options = { pageSize: 'a3' } as unknown as ConvertOptions;
      await expect(
        convertToPdf(await imageFile('png', WIDE), 'png', options),
      ).rejects.toMatchObject({
        error: { params: { what: 'page-size-value' } },
      });
    });

    it('a webp becomes a one-page pdf through the whole route', async () => {
      const { submitOne } = await harness({ converters: [sharpConverter, pdflibConverter] });
      const input = await writeSource(
        'photo.webp',
        await sharp({ create: { ...WIDE, channels: 3, background: '#3366cc' } })
          .webp()
          .toBuffer(),
      );
      const job = await submitOne({ kind: 'convert', input, target: 'pdf', options: {} });
      expect(job.state).toBe('done');
      expect(await pageSizes(job.outputs[0] ?? '')).toHaveLength(1);
    });
  });
});
