import type { Combiner, Converter } from './types/index.ts';

export interface Registry {
  register(item: Converter | Combiner): void;
  /** Registration order: the last graph tie-break (ARCHITECTURE section 8). */
  converters(): Converter[];
  combiners(): Combiner[];
  get(id: string): Converter | Combiner | undefined;
}

const isConverter = (item: Converter | Combiner): item is Converter => 'edges' in item;

export const createRegistry = (): Registry => {
  // One map for both kinds, so an id names one thing and Map keeps insertion order.
  const items = new Map<string, Converter | Combiner>();
  return {
    register(item) {
      // A plain Error, not CoreFailure: a duplicate is a startup bug, never a user-facing failure.
      if (items.has(item.id)) throw new Error(`duplicate registry id: ${item.id}`);
      items.set(item.id, item);
    },
    converters: () => [...items.values()].filter(isConverter),
    combiners: () => [...items.values()].filter((item): item is Combiner => !isConverter(item)),
    get: (id) => items.get(id),
  };
};
