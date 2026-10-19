import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COST } from '../src/costs.ts';
import { CoreFailure } from '../src/errors.ts';
import type { Converter, Format, JobCtx } from '../src/types/index.ts';
import { convertRequest, expectNoTmp, harness, workDirPath, writeSource } from './harness.ts';

// TRD section 6, "Converter must-pass set". Engine-gated by the caller:
// describe.skipIf(!(await converter.available()))(…, () => runConverterContract(…)).
// The caller also calls useWorkDir() once for its test file.
const TRUNCATED_BYTES = 32;
const WEIRD_STEM = 'we ird; $(id) && é 你 name';
// Costs from here up lose quality or data, so their edge must say what is lost.
const LOSSY_COSTS: readonly number[] = [COST.lossyReencode, COST.approximate, COST.majorLoss];

export interface ContractCase {
  converter: Converter;
  from: Format;
  to: Format;
  fixture: string; // absolute path to a valid input in the `from` format
}

let contractCounter = 0;

const makeCtx = (signal: AbortSignal): JobCtx => ({
  signal,
  tmpDir: workDirPath(),
  onProgress: () => undefined,
  note: () => undefined,
});

const outDirFor = async (): Promise<string> => {
  contractCounter += 1;
  const dir = join(workDirPath(), `contract-out-${contractCounter}`);
  await mkdir(dir, { recursive: true });
  return dir;
};

export const runConverterContract = ({ converter, from, to, fixture }: ContractCase): void => {
  const fixtureName = `input.${from}`;

  describe(`contract: ${converter.id} ${from} → ${to}`, () => {
    const stepFor = (input: string, outDir: string) => ({
      input,
      from,
      to,
      outDir,
      baseName: 'input',
      options: {},
    });

    it('writes only inside outDir, and every output exists with size > 0', async () => {
      const input = await writeSource(fixtureName, await readFile(fixture));
      const outDir = await outDirFor();
      const produced = await converter.convert(
        stepFor(input, outDir),
        makeCtx(new AbortController().signal),
      );
      expect(produced.length).toBeGreaterThan(0);
      for (const path of produced) {
        expect(relative(outDir, path).startsWith('..')).toBe(false);
        expect((await stat(path)).size).toBeGreaterThan(0);
      }
      expect(await readdir(outDir)).toHaveLength(produced.length);
    });

    it('leaves the source file untouched', async () => {
      const bytes = await readFile(fixture);
      const input = await writeSource(fixtureName, bytes);
      const before = await stat(input);
      await converter.convert(
        stepFor(input, await outDirFor()),
        makeCtx(new AbortController().signal),
      );
      const after = await stat(input);
      expect(await readFile(input)).toEqual(bytes);
      expect([after.size, after.mtimeMs]).toEqual([before.size, before.mtimeMs]);
    });

    it('an aborted signal gives CANCELLED and no output', async () => {
      const input = await writeSource(fixtureName, await readFile(fixture));
      const outDir = await outDirFor();
      await expect(
        converter.convert(stepFor(input, outDir), makeCtx(AbortSignal.abort())),
      ).rejects.toMatchObject({ error: { code: 'CANCELLED' } });
      expect(await readdir(outDir)).toEqual([]);
    });

    it('cancelling the job leaves no output and no temp dir', async () => {
      const { runner, finished, outDir } = await harness({ converters: [converter] });
      const input = await writeSource(fixtureName, await readFile(fixture));
      const { jobIds } = runner.submit([convertRequest(input, to)]);
      runner.cancel(jobIds[0] ?? '');
      const job = await finished(jobIds[0] ?? '');
      expect(job.state).toBe('cancelled');
      expect(await readdir(outDir)).toEqual([]);
      await expectNoTmp(job);
    });

    it.each([
      ['a zero-byte file', () => Promise.resolve(new Uint8Array())],
      ['a truncated file', async () => (await readFile(fixture)).subarray(0, TRUNCATED_BYTES)],
    ])('%s is a CoreError, not a raw throw, and leaves no temp dir', async (_label, makeBytes) => {
      const bytes = await makeBytes();
      const input = await writeSource(fixtureName, bytes);
      const failure = await converter
        .convert(stepFor(input, await outDirFor()), makeCtx(new AbortController().signal))
        .then(
          () => undefined,
          (caught: unknown) => caught,
        );
      expect(failure).toBeInstanceOf(CoreFailure);

      const { submitOne, outDir } = await harness({ converters: [converter] });
      const job = await submitOne(convertRequest(await writeSource(fixtureName, bytes), to));
      expect(job.state).toBe('failed');
      expect(job.error?.code).toBeDefined();
      expect(await readdir(outDir)).toEqual([]);
      await expectNoTmp(job);
    });

    it('converts a name with spaces, unicode and shell metacharacters', async () => {
      const { submitOne, outDir } = await harness({ converters: [converter] });
      const input = await writeSource(`${WEIRD_STEM}.${from}`, await readFile(fixture));
      const job = await submitOne(convertRequest(input, to));
      expect(job.state).toBe('done');
      const [output] = job.outputs;
      expect(basename(output ?? '')).toBe(`${WEIRD_STEM}.${to}`);
      expect((await stat(output ?? '')).size).toBeGreaterThan(0);
      expect(await readdir(outDir)).toEqual([`${WEIRD_STEM}.${to}`]);
    });

    it('every edge has a cost on the COST scale, and a lossy id where it loses data', () => {
      for (const edge of converter.edges) {
        expect(Object.values(COST)).toContain(edge.cost);
        if (LOSSY_COSTS.includes(edge.cost))
          expect(edge.lossy, `${edge.from} → ${edge.to}`).toBeDefined();
      }
    });
  });
};
