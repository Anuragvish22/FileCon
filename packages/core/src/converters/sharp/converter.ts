import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COST } from '../../costs.ts';
import { CoreFailure } from '../../errors.ts';
import { scaledTimeout } from '../../jobs/timeout.ts';
import { run } from '../../jobs/spawn.ts';
import { validateOptions } from '../../options.ts';
import type { Converter, Edge, Format, OptionKey } from '../../types/index.ts';

// ARCHITECTURE section 8. jpg, png, webp, avif, tiff and gif, between each other.
const IMAGE_FORMATS: readonly Format[] = ['jpg', 'png', 'webp', 'avif', 'tiff', 'gif'];
const LOSSY_TARGETS: readonly Format[] = ['jpg', 'webp', 'avif', 'gif'];
const QUALITY_TARGETS: readonly Format[] = ['jpg', 'webp', 'avif'];
const REENCODED = 'reencoded';

const DEFAULT_TIMEOUT_MS = 120_000;

// Source (tests, dev) runs the .ts file, the bundle (electron-vite) has the worker next to the host as .js.
const WORKER_PATH = fileURLToPath(
  new URL(`./worker.${import.meta.url.endsWith('.ts') ? 'ts' : 'js'}`, import.meta.url),
);

const edgeOptions = (to: Format): OptionKey[] => [
  'width',
  'height',
  'grayscale',
  'keepMetadata',
  ...(QUALITY_TARGETS.includes(to) ? (['quality'] as const) : []),
  ...(to === 'tiff' ? (['tiffCompression'] as const) : []),
  ...(to === 'jpg' ? (['background'] as const) : []),
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

type SharpModule = typeof import('sharp');
let loading: Promise<SharpModule['default']> | undefined;
// Loaded on first use, so a missing or broken native binary shows as "not available" instead of crashing the host.
const loadSharp = (): Promise<SharpModule['default']> =>
  (loading ??= import('sharp').then((module) => {
    // sharp's file cache keeps images open, which on Windows locks the source and the temp dir (EBUSY).
    module.default.cache({ files: 0 });
    return module.default;
  }));

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
    if (ctx.signal.aborted) throw new CoreFailure('CANCELLED');
    const inputBytes = (await stat(req.input)).size;
    try {
      // A child process, because libvips can't be interrupted: killing it is what makes a cancel stop the work.
      const result = await run({
        bin: process.execPath,
        args: [WORKER_PATH, JSON.stringify(req)],
        env: { ELECTRON_RUN_AS_NODE: '1' }, // the host is an Electron process; this makes it behave as plain node
        signal: ctx.signal,
        timeoutMs: scaledTimeout(DEFAULT_TIMEOUT_MS, inputBytes),
      });
      for (const note of JSON.parse(result.stdoutTail) as string[]) ctx.note(note);
      return [join(req.outDir, `${req.baseName}.${req.to}`)];
    } catch (caught) {
      // The child is `node`, but the failure belongs to sharp.
      if (caught instanceof CoreFailure && caught.error.code === 'ENGINE_FAILED')
        throw new CoreFailure('ENGINE_FAILED', { engine: 'sharp' }, caught.error.detail);
      throw caught;
    }
  },
};
