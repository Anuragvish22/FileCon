import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { basename, join, parse, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COST } from '../costs.ts';
import { CoreFailure } from '../errors.ts';
import { run as spawnRun, type RunRequest, type RunResult } from '../jobs/spawn.ts';
import type { Converter, Format } from '../types/index.ts';

// ARCHITECTURE section 8 ("LibreOffice profile"). CONVERSIONS lists these formats for M1; xls and ppt come with M1.2.
const OFFICE_FORMATS: readonly Format[] = [
  'doc',
  'docx',
  'odt',
  'rtf',
  'xlsx',
  'ods',
  'pptx',
  'odp',
];
const DEFAULT_TIMEOUT_MS = 180_000;
// shortcut: one profile slot, because maxConcurrent is 1. The slot stays in the dir name for when that grows.
const PROFILE_SLOT = 0;

export interface LibreOfficeDeps {
  /** The discovered soffice, or undefined when LibreOffice isn't installed. */
  binPath: () => Promise<string | undefined>;
  dataDir: string; // the app's data folder; the profile lives inside it
  run?: (request: RunRequest) => Promise<RunResult>; // tests only
  timeoutMs?: number; // tests only
}

const exists = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  );

export const createLibreOffice = ({
  binPath,
  dataDir,
  run = spawnRun,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: LibreOfficeDeps): Converter => ({
  id: 'libreoffice',
  engineId: 'libreoffice',
  pack: 'office',
  edges: OFFICE_FORMATS.map((from) => ({ from, to: 'pdf', cost: COST.render })),
  maxConcurrent: 1,
  timeoutMs,

  available: async () => (await binPath()) !== undefined,

  async convert(req, ctx) {
    const bin = await binPath();
    if (bin === undefined)
      throw new CoreFailure('ENGINE_MISSING', { engine: 'libreoffice', pack: 'office' });
    if (ctx.signal.aborted) throw new CoreFailure('CANCELLED');
    const input = resolve(req.input); // always absolute, so soffice can't read it as an option
    // soffice turns an empty file into an empty document and exits 0, which would look like a success.
    if ((await stat(input)).size === 0)
      throw new CoreFailure('EMPTY_FILE', { name: basename(input) });

    // A persistent profile saves seconds per run, but a failed run can leave it locked or half-written.
    const profileDir = join(dataDir, `lo-profile-${PROFILE_SLOT}`);
    await mkdir(dataDir, { recursive: true });
    ctx.onProgress(null);
    try {
      const result = await run({
        bin,
        args: [
          '--headless',
          '--norestore',
          `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
          '--convert-to',
          'pdf',
          '--outdir',
          req.outDir,
          input,
        ],
        signal: ctx.signal,
        timeoutMs,
      });
      // soffice names its output after the input, and exits 0 when it could not load the file.
      const produced = join(req.outDir, `${parse(input).name}.pdf`);
      if (!(await exists(produced)))
        throw new CoreFailure(
          'ENGINE_OUTPUT_MISSING',
          { engine: 'libreoffice' },
          result.stderrTail,
        );
      const wanted = join(req.outDir, `${req.baseName}.pdf`);
      if (wanted !== produced) await rename(produced, wanted);
      return [wanted];
    } catch (caught) {
      await rm(profileDir, { recursive: true, force: true });
      throw caught;
    }
  },
});
