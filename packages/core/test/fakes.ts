import { buildGraph, type Graph } from '../src/graph/index.ts';
import { createRegistry, type Registry } from '../src/registry.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Combiner,
  Converter,
  Edge,
  Format,
  JobCtx,
  PackId,
  Route,
  StepRequest,
} from '../src/types/index.ts';

/** What a well-behaved converter does: one file `<baseName>.<to>` inside outDir. */
export const writeOutput = async (req: StepRequest, content = 'converted'): Promise<string[]> => {
  await mkdir(req.outDir, { recursive: true });
  const path = join(req.outDir, `${req.baseName}.${req.to}`);
  await writeFile(path, content);
  return [path];
};

export const fakeConverter = ({
  id,
  pack = 'builtin',
  edges,
  convert = () => Promise.resolve([]),
  maxConcurrent,
  timeoutMs,
}: {
  id: string;
  pack?: PackId;
  edges: Edge[];
  convert?: (req: StepRequest, ctx: JobCtx) => Promise<string[]>;
  maxConcurrent?: number;
  timeoutMs?: number;
}): Converter => ({
  id,
  engineId: id,
  pack,
  edges,
  maxConcurrent,
  timeoutMs,
  available: () => Promise.resolve(true),
  convert,
});

export const fakeCombiner = ({
  id,
  accepts,
  output,
  combine = () => Promise.resolve(''),
}: {
  id: string;
  accepts: Format;
  output: Format;
  combine?: Combiner['combine'];
}): Combiner => ({
  id,
  accepts,
  output,
  combine,
});

export const registryOf = (...items: (Converter | Combiner)[]): Registry => {
  const registry = createRegistry();
  for (const item of items) registry.register(item);
  return registry;
};

/** A graph with every registered converter available. */
export const fullGraphOf = (registry: Registry, priority: string[] = []): Graph =>
  buildGraph({
    registry,
    availableIds: new Set(registry.converters().map((converter) => converter.id)),
    priority,
  });

export const stepsOf = (found: Route | null): string[] | null =>
  found?.steps.map((step) => `${step.converterId}:${step.from}>${step.to}`) ?? null;
