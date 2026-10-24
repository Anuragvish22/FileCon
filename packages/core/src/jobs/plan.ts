import { basename } from 'node:path';
import { detect } from '../detect.ts';
import { CoreFailure } from '../errors.ts';
import { route as findRoute, type Graph } from '../graph/index.ts';
import { isConverter, type Registry } from '../registry.ts';
import type { Format, Route } from '../types/index.ts';

export interface PlanDeps {
  registry: Registry;
  /** A function, so the host can rebuild the graphs when engines change. */
  graphs: () => { available: Graph; full: Graph };
}

/** No route on the available graph: ENGINE_MISSING if the full graph has one, else NO_ROUTE. */
export const planRoute = ({ registry, graphs }: PlanDeps, from: Format, to: Format): Route => {
  const { available, full } = graphs();
  const found = findRoute(available, from, to);
  if (found !== null) return found;
  const wanted = findRoute(full, from, to);
  const missingStep = wanted?.steps.find((step) => !available.converterIds.has(step.converterId));
  const converter = missingStep === undefined ? undefined : registry.get(missingStep.converterId);
  if (isConverter(converter))
    throw new CoreFailure('ENGINE_MISSING', { engine: converter.engineId, pack: converter.pack });
  throw new CoreFailure('NO_ROUTE', { from, to });
};

/** The re-check at job start: the file must still exist and be a format we know. */
export const detectInput = async (input: string): Promise<Format> => {
  const result = await detect(input);
  if (result.error !== undefined)
    throw new CoreFailure(result.error.code, result.error.params, result.error.detail);
  if (result.format === null)
    throw new CoreFailure('UNSUPPORTED_FORMAT', { name: basename(input) });
  return result.format;
};
