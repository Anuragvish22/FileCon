import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergePdf } from '../../src/combiners/merge-pdf.ts';
import { pdflibConverter } from '../../src/converters/pdflib.ts';
import type { JobCtx } from '../../src/types/index.ts';
import { runCombinerContract } from '../contract.ts';
import { fixture, harness, NO_OPTIONS, useWorkDir, workDirPath, writeSource } from '../harness.ts';
import { makePdf, pageSizes, type PageSize } from '../pdfs.ts';

const ONE: PageSize[] = [{ width: 100, height: 100 }];
const TWO: PageSize[] = [
  { width: 200, height: 200 },
  { width: 210, height: 210 },
];
const THREE: PageSize[] = [
  { width: 300, height: 300 },
  { width: 310, height: 310 },
  { width: 320, height: 320 },
];
// The smallest file pdf-lib sees as encrypted: the trailer names an Encrypt dictionary.
const ENCRYPTED_PDF = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj
3 0 obj << /Filter /Standard /V 1 /R 2 /O (aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) /U (bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb) /P -4 >> endobj
trailer << /Root 1 0 R /Size 4 /Encrypt 3 0 R /ID [<00> <00>] >>
%%EOF
`;

const ctxOf = (overrides: Partial<JobCtx> = {}): JobCtx => ({
  signal: new AbortController().signal,
  tmpDir: workDirPath(),
  onProgress: () => undefined,
  note: () => undefined,
  ...overrides,
});

let counter = 0;
const merge = async (inputs: string[], overrides: Partial<JobCtx> = {}): Promise<string> => {
  counter += 1;
  const outDir = join(workDirPath(), `merge-out-${counter}`);
  await mkdir(outDir, { recursive: true });
  return mergePdf.combine({ inputs, outDir, options: NO_OPTIONS }, ctxOf(overrides));
};

const pdfFile = async (name: string, sizes: PageSize[]): Promise<string> =>
  writeSource(name, await makePdf(sizes));

useWorkDir();

describe('merge-pdf combiner', () => {
  describe('happy path', () => {
    it('merges 1 + 2 + 3 pages into 6, in the given order', async () => {
      const inputs = [
        await pdfFile('a.pdf', ONE),
        await pdfFile('b.pdf', TWO),
        await pdfFile('c.pdf', THREE),
      ];
      expect(await pageSizes(await merge(inputs))).toEqual([...ONE, ...TWO, ...THREE]);
    });

    it('a real job merges a png, a pdf and a jpg into "<first stem> merged.pdf"', async () => {
      const { submitOne, outDir } = await harness({
        converters: [pdflibConverter],
        combiners: [mergePdf],
      });
      const png = await writeSource('first.png', await readFile(fixture('png', 'sample.png')));
      const pdf = await pdfFile('second.pdf', TWO);
      const jpg = await writeSource('third.jpg', await readFile(fixture('jpg', 'sample.jpg')));
      const job = await submitOne({
        kind: 'merge',
        inputs: [png, pdf, jpg],
        combinerId: 'merge-pdf',
        options: NO_OPTIONS,
      });
      expect(job.state).toBe('done');
      expect(job.outputs).toEqual([join(outDir, 'first merged.pdf')]);
      expect(await pageSizes(job.outputs[0] ?? '')).toHaveLength(1 + TWO.length + 1);
    });
  });

  describe('contract', () => {
    runCombinerContract({
      combiner: mergePdf,
      fixtures: [fixture('pdf', 'sample.pdf'), fixture('pdf', 'sample.pdf')],
    });
  });

  describe('must also pass', () => {
    it('reversing the inputs reverses the pages', async () => {
      const first = await pdfFile('a.pdf', ONE);
      const second = await pdfFile('b.pdf', TWO);
      expect(await pageSizes(await merge([second, first]))).toEqual([...TWO, ...ONE]);
    });

    it('a single input merges to the same pages', async () => {
      expect(await pageSizes(await merge([await pdfFile('a.pdf', THREE)]))).toEqual(THREE);
    });

    it('a corrupt input is ENGINE_FAILED and names the file', async () => {
      const bad = await writeSource('bad.pdf', 'this is not a pdf');
      await expect(merge([await pdfFile('a.pdf', ONE), bad])).rejects.toMatchObject({
        error: { code: 'ENGINE_FAILED', params: { engine: 'pdflib', name: 'bad.pdf' } },
      });
    });

    it('an encrypted input is INPUT_ENCRYPTED', async () => {
      const locked = await writeSource('locked.pdf', ENCRYPTED_PDF);
      await expect(merge([locked])).rejects.toMatchObject({
        error: { code: 'INPUT_ENCRYPTED', params: { name: 'locked.pdf' } },
      });
    });

    it('an abort between inputs is CANCELLED and writes nothing', async () => {
      const controller = new AbortController();
      const inputs = [await pdfFile('a.pdf', ONE), await pdfFile('b.pdf', TWO)];
      counter += 1;
      const outDir = join(workDirPath(), `merge-out-${counter}`);
      await mkdir(outDir, { recursive: true });
      await expect(
        mergePdf.combine(
          { inputs, outDir, options: NO_OPTIONS },
          ctxOf({ signal: controller.signal, onProgress: () => controller.abort() }),
        ),
      ).rejects.toMatchObject({ error: { code: 'CANCELLED' } });
      expect(await readdir(outDir)).toEqual([]);
    });

    it('progress reaches 1 after the last input', async () => {
      const seen: (number | null)[] = [];
      await merge([await pdfFile('a.pdf', ONE), await pdfFile('b.pdf', TWO)], {
        onProgress: (fraction) => seen.push(fraction),
      });
      expect(seen).toEqual([0.5, 1]);
    });
  });
});
