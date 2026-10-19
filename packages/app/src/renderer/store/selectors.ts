import type {
  DetectResult,
  Format,
  Job,
  OptionKey,
  TargetOption,
  TargetsResult,
} from '@filecon/core/types';
import type { State } from './state.ts';

type MergeChoice = TargetsResult['merge'][number];

const MIN_FILES_TO_MERGE = 2;

/** Rows core can work with: detected, supported and readable. */
export const convertibleFiles = (state: State): DetectResult[] =>
  state.files.filter((file) => file.error === undefined && file.format !== null);

/** What `targets()` is asked about: each distinct input format once. */
export const inputFormats = (state: State): Format[] => [
  ...new Set(
    convertibleFiles(state).flatMap((file) => (file.format === null ? [] : [file.format])),
  ),
];

/**
 * Single-file targets plus outputs that only a merge makes (two pdfs to one pdf), which the picker lists
 * as ordinary rows (UI-DESIGN section 3).
 */
export const offeredTargets = (state: State): TargetOption[] => {
  if (state.targets.status !== 'ready') return [];
  const { convert, merge } = state.targets.result;
  const count = convertibleFiles(state).length;
  const mergeOnly = merge
    // A merge needs 2 files unless the route fans out, the same rule as the toggle (mergeChoice).
    .filter((choice) => count >= MIN_FILES_TO_MERGE || choice.fanOut)
    .filter((choice) => !convert.some((option) => option.format === choice.output))
    .map((choice): TargetOption => ({
      format: choice.output,
      status: choice.status,
      ...(choice.pack === undefined ? {} : { pack: choice.pack }),
      lossy: [],
      fanOut: choice.fanOut,
      options: [],
    }));
  return [...convert, ...mergeOnly];
};

/** True when the chosen target has no single-file route, so only the merge toggle can produce it. */
export const mergeOnlyTarget = (state: State): boolean =>
  state.targets.status === 'ready' &&
  state.selection.target !== null &&
  !state.targets.result.convert.some((option) => option.format === state.selection.target);

export const selectedTarget = (state: State): TargetOption | undefined =>
  offeredTargets(state).find((option) => option.format === state.selection.target);

/** The merge toggle shows for 2 or more files, or for one file whose route fans out (UI-DESIGN section 4). */
export const mergeChoice = (state: State): MergeChoice | undefined => {
  if (state.targets.status !== 'ready') return undefined;
  const count = convertibleFiles(state).length;
  return state.targets.result.merge.find(
    (merge) =>
      merge.output === state.selection.target && (count >= MIN_FILES_TO_MERGE || merge.fanOut),
  );
};

export const visibleOptions = (state: State): OptionKey[] => {
  const merge = state.selection.mergeMode ? mergeChoice(state) : undefined;
  return merge === undefined ? (selectedTarget(state)?.options ?? []) : [];
};

/** A target that needs a pack cannot be submitted (UI-DESIGN section 5). */
export const canConvert = (state: State): boolean => {
  if (state.core.status !== 'ready') return false;
  if (!pagesValid(state.selection.options.pages ?? '')) return false;
  if (state.detecting.length > 0 || convertibleFiles(state).length === 0) return false;
  if (state.selection.mergeMode) return mergeChoice(state)?.status === 'ready';
  return !mergeOnlyTarget(state) && selectedTarget(state)?.status === 'ready';
};

export interface BatchSummary {
  total: number;
  counts: Record<Job['state'], number>;
  /** Something is still queued or running. */
  active: boolean;
}

export const batchSummary = (state: State): BatchSummary => {
  const counts: BatchSummary['counts'] = {
    queued: 0,
    running: 0,
    done: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const job of state.jobs.values()) counts[job.state] += 1;
  return { total: state.jobs.size, counts, active: counts.queued + counts.running > 0 };
};

// UI-DESIGN section 2 and CONTRACTS section 2: N, N-M, N- or -M, comma separated, spaces ignored.
const PAGES_SYNTAX = /^(\d+(-\d*)?|-\d+)(,(\d+(-\d*)?|-\d+))*$/;

export const pagesValid = (text: string): boolean => {
  const compact = text.replaceAll(' ', '');
  if (compact === '') return true;
  if (!PAGES_SYNTAX.test(compact)) return false;
  return compact.split(',').every((part) => {
    const [from, to] = part.split('-');
    return (
      (from === '' || Number(from) >= 1) &&
      (to === undefined || to === '' || Number(to) >= Math.max(1, Number(from)))
    );
  });
};
