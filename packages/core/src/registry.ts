import type { Combiner, Converter } from './types/index.ts';

export interface Registry {
  register(x: Converter | Combiner): void;
  /** Registration order: the last graph tie-break (ARCHITECTURE section 8). */
  converters(): Converter[];
  combiners(): Combiner[];
  get(id: string): Converter | Combiner | undefined;
}

const isConverter = (x: Converter | Combiner): x is Converter => 'edges' in x;

export const createRegistry = (): Registry => {
  // One map for both kinds, so an id names one thing and Map keeps insertion order.
  const items = new Map<string, Converter | Combiner>();
  return {
    register(x) {
      // A plain Error, not CoreFailure: a duplicate is a startup bug, never a user-facing failure.
      if (items.has(x.id)) throw new Error(`duplicate registry id: ${x.id}`);
      items.set(x.id, x);
    },
    converters: () => [...items.values()].filter(isConverter),
    combiners: () => [...items.values()].filter((x): x is Combiner => !isConverter(x)),
    get: (id) => items.get(id),
  };
};
