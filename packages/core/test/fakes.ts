import { buildGraph, type Graph } from '../src/graph/index.ts';
import { createRegistry, type Registry } from '../src/registry.ts';
import type { Combiner, Converter, Edge, Format, PackId, Route } from '../src/types/index.ts';

export const fakeConverter = ({
  id,
  pack = 'builtin',
  edges,
}: {
  id: string;
  pack?: PackId;
  edges: Edge[];
}): Converter => ({
  id,
  engineId: id,
  pack,
  edges,
  available: () => Promise.resolve(true),
  convert: () => Promise.resolve([]),
});

export const fakeCombiner = ({
  id,
  accepts,
  output,
}: {
  id: string;
  accepts: Format;
  output: Format;
}): Combiner => ({
  id,
  accepts,
  output,
  combine: () => Promise.resolve(''),
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
