import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileTypeFromFile } from 'file-type';
import { PDFDocument } from 'pdf-lib';
import { afterAll, describe, expect, it } from 'vitest';
import { createLibreOffice } from '../../src/converters/libreoffice.ts';
import { discover } from '../../src/engines/discovery.ts';
import { ENGINE_SPECS } from '../../src/engines/specs.ts';
import type { Format, JobCtx } from '../../src/types/index.ts';
import { runConverterContract } from '../contract.ts';
import { expectNoTmp, fixture, harness, useWorkDir, workDirPath, writeSource } from '../harness.ts';

const SHORT_TIMEOUT_MS = 100;
const POLL_MS = 100;
const POLL_ATTEMPTS = 50;
const PROFILE_DIR = 'lo-profile-0';
const TRUNCATED_BYTES = 300;

const spec = ENGINE_SPECS.find((candidate) => candidate.id === 'libreoffice');
if (spec === undefined) throw new Error('libreoffice spec is missing');
const found = await discover({ spec });
const binPath = (): Promise<string | undefined> => Promise.resolve(found.path);

// One data dir for the whole file, so the profile is shared across tests the way it is in the app.
const dataDir = mkdtempSync(join(tmpdir(), 'filecon-lo-data-'));
afterAll(async () => {
  await rm(dataDir, { recursive: true, force: true });
});
const profilePath = join(dataDir, PROFILE_DIR);

const converter = createLibreOffice({ binPath, dataDir });

const ctxOf = (overrides: Partial<JobCtx> = {}): JobCtx => ({
  signal: new AbortController().signal,
  tmpDir: workDirPath(),
  onProgress: () => undefined,
  note: () => undefined,
  ...overrides,
});

let counter = 0;
const outDirFor = (): string => {
  counter += 1;
  const dir = join(workDirPath(), `lo-out-${counter}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

const convert = (
  input: string,
  from: Format,
  options: { baseName?: string; using?: typeof converter } = {},
): Promise<string[]> =>
  (options.using ?? converter).convert(
    {
      input,
      from,
      to: 'pdf',
      outDir: outDirFor(),
      baseName: options.baseName ?? 'out',
      options: {},
    },
    ctxOf(),
  );

const pageCount = async (path: string): Promise<number> =>
  (await PDFDocument.load(await readFile(path))).getPageCount();

const isDir = (path: string): Promise<boolean> =>
  stat(path).then(
    (stats) => stats.isDirectory(),
    () => false,
  );

/** Processes whose command line mentions the data dir: any soffice left running from our profile. */
const leftoverProcesses = async (): Promise<string[]> => {
  const result = await promisify(execFile)('pgrep', ['-f', dataDir]).catch(() => ({ stdout: '' }));
  return result.stdout.split('\n').filter(Boolean);
};

useWorkDir();

describe.skipIf(!(await converter.available()))('libreoffice converter', () => {
  describe('golden: every office format becomes a pdf with at least one page', () => {
    it.each([
      ['doc', 'doc', 'report.doc'],
      ['docx', 'docx', 'report.docx'],
      ['odt', 'odt', 'report.odt'],
      ['rtf', 'rtf', 'report.rtf'],
      ['xlsx', 'xlsx', 'sheet.xlsx'],
      ['ods', 'ods', 'sheet.ods'],
      ['pptx', 'pptx', 'slides.pptx'],
      ['odp', 'odp', 'slides.odp'],
    ] as const)('%s → pdf', async (from, folder, name) => {
      const [output] = await convert(
        await writeSource(name, await readFile(fixture(folder, name))),
        from,
      );
      expect((await fileTypeFromFile(output ?? ''))?.ext).toBe('pdf');
      expect(await pageCount(output ?? '')).toBeGreaterThanOrEqual(1);
    });
  });

  describe('edges', () => {
    it('are the eight M1 office formats → pdf at the render cost, one conversion at a time', () => {
      expect(converter.edges.map((edge) => `${edge.from}>${edge.to}`)).toEqual([
        'doc>pdf',
        'docx>pdf',
        'odt>pdf',
        'rtf>pdf',
        'xlsx>pdf',
        'ods>pdf',
        'pptx>pdf',
        'odp>pdf',
      ]);
      expect(converter.maxConcurrent).toBe(1);
      expect(converter.timeoutMs).toBe(180_000);
    });
  });

  describe('contract', () => {
    runConverterContract({
      converter,
      from: 'docx',
      to: 'pdf',
      fixture: fixture('docx', 'report.docx'),
      truncateAt: TRUNCATED_BYTES, // any shorter and soffice reads the zip fragment as plain text and exports it
    });
  });

  describe('profile', () => {
    it('two jobs in a row reuse the profile dir instead of recreating it', async () => {
      const input = await writeSource(
        'report.docx',
        await readFile(fixture('docx', 'report.docx')),
      );
      await convert(input, 'docx');
      expect(await isDir(profilePath)).toBe(true);
      const marker = join(profilePath, 'kept-by-the-test');
      await writeFile(marker, 'still here');
      await convert(input, 'docx');
      expect(await readFile(marker, 'utf8')).toBe('still here');
    });

    it('a timeout is TIMEOUT, removes the profile and the process, and the next job works', async () => {
      const input = await writeSource(
        'report.docx',
        await readFile(fixture('docx', 'report.docx')),
      );
      const impatient = createLibreOffice({ binPath, dataDir, timeoutMs: SHORT_TIMEOUT_MS });
      await rm(profilePath, { recursive: true, force: true }); // a cold start is slower than the timeout
      await expect(convert(input, 'docx', { using: impatient })).rejects.toMatchObject({
        error: { code: 'TIMEOUT' },
      });
      expect(await isDir(profilePath)).toBe(false);
      for (
        let attempt = 0;
        attempt < POLL_ATTEMPTS && (await leftoverProcesses()).length > 0;
        attempt += 1
      )
        await new Promise((done) => setTimeout(done, POLL_MS));
      expect(await leftoverProcesses()).toEqual([]);

      const [output] = await convert(input, 'docx');
      expect(await pageCount(output ?? '')).toBeGreaterThanOrEqual(1);
    });

    it('a corrupt file fails cleanly, and the next job still works', async () => {
      const whole = await readFile(fixture('docx', 'report.docx'));
      const broken = await writeSource('broken.docx', whole.subarray(0, TRUNCATED_BYTES));
      const failure = await convert(broken, 'docx').then(
        () => undefined,
        (caught: unknown) => caught as { error: { code: string; detail?: string } },
      );
      expect(['ENGINE_FAILED', 'ENGINE_OUTPUT_MISSING']).toContain(failure?.error.code);
      expect(await isDir(profilePath)).toBe(false);

      const good = await writeSource('report.docx', whole);
      expect(await pageCount((await convert(good, 'docx'))[0] ?? '')).toBeGreaterThanOrEqual(1);
    });

    it("names the output after baseName, and leaves nothing under soffice's own name", async () => {
      const input = await writeSource(
        'report.docx',
        await readFile(fixture('docx', 'report.docx')),
      );
      const outDir = outDirFor();
      const [output] = await converter.convert(
        { input, from: 'docx', to: 'pdf', outDir, baseName: 'renamed', options: {} },
        ctxOf(),
      );
      expect(output).toBe(join(outDir, 'renamed.pdf'));
      expect(await readdir(outDir)).toEqual(['renamed.pdf']);
    });

    it('a whole job through the runner leaves no temp dir', async () => {
      const { submitOne, outDir } = await harness({ converters: [converter] });
      const input = await writeSource(
        'report.docx',
        await readFile(fixture('docx', 'report.docx')),
      );
      const job = await submitOne({ kind: 'convert', input, target: 'pdf', options: {} });
      expect(job.state).toBe('done');
      expect(job.outputs).toEqual([join(outDir, 'report.pdf')]);
      await expectNoTmp(job);
    });
  });
});

// These need no LibreOffice: the process runner is replaced, to reach failures soffice can't be made to give on demand.
describe('libreoffice converter: failures of the engine process', () => {
  const fakeDataDir = mkdtempSync(join(tmpdir(), 'filecon-lo-fake-'));
  afterAll(async () => {
    await rm(fakeDataDir, { recursive: true, force: true });
  });
  const fakeProfile = join(fakeDataDir, PROFILE_DIR);

  const withFake = (run: NonNullable<Parameters<typeof createLibreOffice>[0]['run']>) =>
    createLibreOffice({
      binPath: () => Promise.resolve('/fake/soffice'),
      dataDir: fakeDataDir,
      run,
    });

  it('a non-zero exit is passed on and the profile is removed', async () => {
    await mkdir(fakeProfile, { recursive: true });
    const input = await writeSource('report.docx', await readFile(fixture('docx', 'report.docx')));
    const failing = withFake(() =>
      Promise.reject(Object.assign(new Error('exit 1'), { error: { code: 'ENGINE_FAILED' } })),
    );
    await expect(convert(input, 'docx', { using: failing })).rejects.toThrow('exit 1');
    expect(await isDir(fakeProfile)).toBe(false);
  });

  it('exit 0 without an output is ENGINE_OUTPUT_MISSING with the stderr as detail, and the profile is removed', async () => {
    await mkdir(fakeProfile, { recursive: true });
    const input = await writeSource('report.docx', await readFile(fixture('docx', 'report.docx')));
    const silent = withFake(() =>
      Promise.resolve({
        code: 0,
        stdoutTail: '',
        stderrTail: 'Error: source file could not be loaded',
      }),
    );
    await expect(convert(input, 'docx', { using: silent })).rejects.toMatchObject({
      error: { code: 'ENGINE_OUTPUT_MISSING', detail: 'Error: source file could not be loaded' },
    });
    expect(await isDir(fakeProfile)).toBe(false);
  });

  it('gives soffice a longer limit for a bigger input', async () => {
    const seen: number[] = [];
    const recording = withFake((request) => {
      seen.push(request.timeoutMs);
      return Promise.resolve({ code: 0, stdoutTail: '', stderrTail: '' });
    });
    const small = await writeSource('small.docx', Buffer.alloc(10));
    const big = await writeSource('big.docx', Buffer.alloc(5_000_000));
    for (const input of [small, big])
      await convert(input, 'docx', { using: recording }).catch(() => undefined);
    expect(seen[0]).toBe(180_000);
    expect(seen[1]).toBe(180_000 + 5 * 4000);
  });

  it('without LibreOffice the converter is not available and says ENGINE_MISSING', async () => {
    const missing = createLibreOffice({
      binPath: () => Promise.resolve(undefined),
      dataDir: fakeDataDir,
    });
    expect(await missing.available()).toBe(false);
    const input = await writeSource('report.docx', await readFile(fixture('docx', 'report.docx')));
    await expect(convert(input, 'docx', { using: missing })).rejects.toMatchObject({
      error: { code: 'ENGINE_MISSING', params: { engine: 'libreoffice', pack: 'office' } },
    });
  });

  it('the command is an argument array with the profile as a file URL and the input last', async () => {
    let seen: { bin: string; args: readonly string[] } | undefined;
    const recording = withFake((request) => {
      seen = { bin: request.bin, args: request.args };
      return Promise.resolve({ code: 0, stdoutTail: '', stderrTail: '' });
    });
    const input = await writeSource(
      'we ird; $(id) && name.docx',
      await readFile(fixture('docx', 'report.docx')),
    );
    await convert(input, 'docx', { using: recording }).catch(() => undefined);
    expect(seen?.bin).toBe('/fake/soffice');
    expect(seen?.args.slice(0, 2)).toEqual(['--headless', '--norestore']);
    expect(seen?.args[2]).toBe(`-env:UserInstallation=file://${fakeProfile}`);
    expect(seen?.args.slice(3, 6)).toEqual(['--convert-to', 'pdf', '--outdir']);
    expect(seen?.args.at(-1)).toBe(input);
  });
});
