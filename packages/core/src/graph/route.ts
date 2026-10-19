import type { Format, Route } from '../types/index.ts';
import type { Graph, GraphEdge } from './build.ts';

export const MAX_HOPS = 3;

/** Best route within MAX_HOPS, or null. `from === to` is only ever the 1-step self-edge. */
export const route = (graph: Graph, from: Format, to: Format): Route | null =>
  bestPathsFrom(graph, from).get(to)?.route ?? null;

/** A finished best path, with its contract Route built once so route() returns the same object. */
export interface BestPath {
  edges: GraphEdge[];
  route: Route;
}

// Keyed by graph object, so a rebuilt graph starts with an empty cache.
const searches = new WeakMap<Graph, Map<Format, ReadonlyMap<Format, BestPath>>>();

/** Every format `from` reaches, with its best path: the search, plus `from` by its self-edge. */
export const bestPathsFrom = (graph: Graph, from: Format): ReadonlyMap<Format, BestPath> => {
  let bySource = searches.get(graph);
  if (bySource === undefined) {
    bySource = new Map();
    searches.set(graph, bySource);
  }
  const cached = bySource.get(from);
  if (cached !== undefined) return cached;

  const paths = new Map<Format, BestPath>();
  for (const [format, path] of searchFrom(graph, from)) paths.set(format, bestPathOf(path.edges));
  const selfEdge = graph.selfEdges.get(from);
  if (selfEdge !== undefined) paths.set(from, bestPathOf([selfEdge]));
  bySource.set(from, paths);
  return paths;
};

const bestPathOf = (edges: GraphEdge[]): BestPath => ({
  edges,
  route: {
    steps: edges.map((edge) => ({ converterId: edge.converter.id, from: edge.from, to: edge.to })),
    cost: edges.reduce((sum, edge) => sum + edge.cost, 0),
    hops: edges.length,
    lossy: unique(edges.flatMap((edge) => (edge.lossy === undefined ? [] : [edge.lossy]))),
    fanOut: edges.some((edge) => edge.fanOut === true),
  },
});

/** A route under construction. */
interface Path {
  at: Format;
  visited: Format[]; // the start and every format reached, for the no-cycle rule
  edges: GraphEdge[];
  cost: number;
  rankSum: number;
}

// Two tables, not one: a cheap path that already fanned out would otherwise hide a dearer one
// that still may, and a route needing that fan-out would be missed.
interface Frontier {
  single: Map<Format, Path>;
  fannedOut: Map<Format, Path>; // already used its one fan-out
}

/** Best path from `from` to every other format within MAX_HOPS. Self-edges are never used. */
const searchFrom = (graph: Graph, from: Format): Map<Format, Path> => {
  const start: Path = { at: from, visited: [from], edges: [], cost: 0, rankSum: 0 };
  let best: Frontier = { single: new Map([[from, start]]), fannedOut: new Map() };
  for (let hop = 1; hop <= MAX_HOPS; hop++) {
    const next: Frontier = { single: new Map(best.single), fannedOut: new Map(best.fannedOut) };
    for (const path of best.single.values()) {
      for (const edge of graph.outEdges.get(path.at) ?? []) {
        keepBetter(edge.fanOut === true ? next.fannedOut : next.single, extend(path, edge));
      }
    }
    for (const path of best.fannedOut.values()) {
      for (const edge of graph.outEdges.get(path.at) ?? []) {
        if (edge.fanOut !== true) keepBetter(next.fannedOut, extend(path, edge)); // one fan-out max
      }
    }
    best = next;
  }
  best.single.delete(from); // the empty start; `from` reaches itself only by its self-edge
  const winners = new Map(best.single);
  for (const [format, path] of best.fannedOut) {
    if (isBetterPath(path, winners.get(format))) winners.set(format, path);
  }
  return winners;
};

/** The path one edge longer, or null when the edge goes back to a format already on it. */
const extend = (path: Path, edge: GraphEdge): Path | null =>
  path.visited.includes(edge.to)
    ? null
    : {
        at: edge.to,
        visited: [...path.visited, edge.to],
        edges: [...path.edges, edge],
        cost: path.cost + edge.cost,
        rankSum: path.rankSum + edge.rank,
      };

const keepBetter = (table: Map<Format, Path>, candidate: Path | null): void => {
  if (candidate !== null && isBetterPath(candidate, table.get(candidate.at))) {
    table.set(candidate.at, candidate);
  }
};

const isBetterPath = (candidate: Path, current: Path | undefined): boolean => {
  if (current === undefined) return true;
  if (candidate.cost !== current.cost) return candidate.cost < current.cost;
  if (candidate.edges.length !== current.edges.length)
    return candidate.edges.length < current.edges.length;
  return candidate.rankSum < current.rankSum;
};

export const unique = <Item>(items: Item[]): Item[] => [...new Set(items)];
