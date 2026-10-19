import type { Registry } from '../registry.ts';
import type { Combiner, Converter, Edge, Format } from '../types/index.ts';

/** A converter's edge, plus who runs it and how preferred that converter is. */
export interface GraphEdge extends Edge {
  converter: Converter;
  rank: number; // index in Settings.engines.priority, unlisted = priority.length
}

export interface Graph {
  readonly outEdges: ReadonlyMap<Format, GraphEdge[]>; // from !== to only
  readonly selfEdges: ReadonlyMap<Format, GraphEdge>;
  readonly converterIds: ReadonlySet<string>;
  readonly combiners: readonly Combiner[];
}

export interface BuildGraphInput {
  registry: Registry;
  availableIds: ReadonlySet<string>; // converter ids to include; every id for the full graph
  priority: readonly string[];
}

export const buildGraph = ({ registry, availableIds, priority }: BuildGraphInput): Graph => {
  const bestByPair = new Map<string, GraphEdge>();
  const converters = registry.converters().filter((converter) => availableIds.has(converter.id));
  for (const converter of converters) {
    const priorityIndex = priority.indexOf(converter.id);
    const rank = priorityIndex === -1 ? priority.length : priorityIndex;
    for (const edge of converter.edges) {
      const candidate: GraphEdge = { ...edge, converter, rank };
      const pairKey = `${edge.from}>${edge.to}`;
      if (beatsForSamePair(candidate, bestByPair.get(pairKey))) bestByPair.set(pairKey, candidate);
    }
  }
  const outEdges = new Map<Format, GraphEdge[]>();
  const selfEdges = new Map<Format, GraphEdge>();
  for (const edge of bestByPair.values()) {
    if (edge.from === edge.to) selfEdges.set(edge.from, edge);
    else outEdges.set(edge.from, [...(outEdges.get(edge.from) ?? []), edge]);
  }
  return {
    outEdges,
    selfEdges,
    converterIds: new Set(converters.map((converter) => converter.id)),
    combiners: registry.combiners(),
  };
};

// Registration order is the last tie-break, so a later converter replaces only a strictly better one.
const beatsForSamePair = (candidate: GraphEdge, current: GraphEdge | undefined): boolean =>
  current === undefined ||
  candidate.cost < current.cost ||
  (candidate.cost === current.cost && candidate.rank < current.rank);
