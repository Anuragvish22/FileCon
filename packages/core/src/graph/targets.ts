import type { Format, PackId, TargetOption, TargetsResult } from '../types/index.ts';
import type { Graph } from './build.ts';
import { bestPathsFrom, unique, type BestPath } from './route.ts';

export interface TargetsInput {
  available: Graph;
  full: Graph;
  formats: readonly Format[]; // distinct input formats; duplicates are ignored
}

export const targets = ({ available, full, formats }: TargetsInput): TargetsResult => {
  const inputs = unique([...formats]);
  const [firstInput] = inputs;
  if (firstInput === undefined) return { convert: [], merge: [], extract: [] };
  const graphs = { available, full };

  const convert: TargetOption[] = [];
  // A target every input reaches is one the first input reaches; reachFromAll checks the rest.
  for (const target of bestPathsFrom(full, firstInput).keys()) {
    const reach = reachFromAll({ graphs, inputs, target });
    if (reach === null) continue;
    const { paths, ...availability } = reach; // { status } or { status, pack }
    const option: TargetOption = {
      format: target,
      ...availability,
      lossy: unique(paths.flatMap((path) => path.route.lossy)),
      fanOut: paths.some((path) => path.route.fanOut),
      options: unique(paths.flatMap((path) => path.edges.flatMap((edge) => edge.options ?? []))),
    };
    const [onlyPath] = paths;
    if (reach.status === 'ready' && inputs.length === 1 && onlyPath) option.route = onlyPath.route;
    convert.push(option);
  }

  const merge: TargetsResult['merge'] = [];
  for (const combiner of full.combiners) {
    // An input already in the accepted format needs no route, and no self-edge either.
    const needRouting = inputs.filter((input) => input !== combiner.accepts);
    const reach = reachFromAll({ graphs, inputs: needRouting, target: combiner.accepts });
    if (reach === null) continue;
    const { paths, ...availability } = reach;
    merge.push({
      combinerId: combiner.id,
      output: combiner.output,
      ...availability,
      fanOut: paths.some((path) => path.route.fanOut),
    });
  }

  // shortcut: no extractors before M1.1-3, which adds them to the registry and this list.
  return { convert, merge, extract: [] };
};

interface ReachInput {
  graphs: { available: Graph; full: Graph };
  inputs: Format[];
  target: Format;
}

interface Reach {
  status: 'ready' | 'needs-pack';
  pack?: PackId; // the key is left out, not undefined, when there's no pack
  paths: BestPath[]; // available paths when ready, full paths when needs-pack
}

/** Offered when the full graph reaches `target` from every input; ready when the available one does too. */
const reachFromAll = ({ graphs, inputs, target }: ReachInput): Reach | null => {
  const fullPaths = inputs.map((input) => bestPathsFrom(graphs.full, input).get(target));
  if (!fullPaths.every(isDefined)) return null;
  const availablePaths = inputs.map((input) => bestPathsFrom(graphs.available, input).get(target));
  if (availablePaths.every(isDefined)) return { status: 'ready', paths: availablePaths };
  // The pack comes from an input that is actually blocked, not from one that is ready another way.
  for (const [inputIndex, fullPath] of fullPaths.entries()) {
    if (availablePaths[inputIndex] !== undefined) continue;
    const missing = fullPath.edges.find(
      (edge) => !graphs.available.converterIds.has(edge.converter.id),
    );
    if (missing !== undefined) {
      return { status: 'needs-pack', pack: missing.converter.pack, paths: fullPaths };
    }
  }
  return { status: 'needs-pack', paths: fullPaths };
};

const isDefined = <Item>(item: Item | undefined): item is Item => item !== undefined;
