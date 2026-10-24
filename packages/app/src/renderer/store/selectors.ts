import type {
  ConvertOptions,
  DetectResult,
  Format,
  Job,
  JobRequest,
  OptionKey,
  TargetOption,
  TargetsResult,
} from '@filecon/core/types';
import { isTerminal } from '@filecon/core/types';
import type { Choice, MergeGroup, State } from './state.ts';

export type MergeChoice = TargetsResult['merge'][number];

export const MIN_GROUP_SIZE = 2;

const NO_CHOICE: Choice = { target: null, options: {} };

/** Rows core can work with: detected, supported and readable. */
export const isSupported = (file: DetectResult): boolean =>
  file.error === undefined && file.format !== null;

export const targetsKey = (formats: readonly Format[]): string =>
  [...new Set(formats)].sort().join(',');

export const groupOf = (state: State, path: string): MergeGroup | undefined =>
  state.groups.find((group) => group.members.includes(path));

/** Files that are their own row, in list order. Group members live under their group. */
export const singleFiles = (state: State): DetectResult[] =>
  state.files.filter((file) => groupOf(state, file.path) === undefined);

export const membersOf = (state: State, group: MergeGroup): DetectResult[] =>
  group.members.flatMap((path) => state.files.filter((file) => file.path === path));

const formatsOf = (files: DetectResult[]): Format[] =>
  files.flatMap((file) => (file.format === null ? [] : [file.format]));

/** What `targets()` is asked about: each distinct input format once, and each group's set of formats. */
export const neededTargets = (state: State): Format[][] => {
  const wanted = new Map<string, Format[]>();
  const add = (formats: Format[]): void => {
    if (formats.length > 0) wanted.set(targetsKey(formats), [...new Set(formats)]);
  };
  for (const file of state.files) if (isSupported(file)) add(formatsOf([file]));
  for (const group of state.groups) add(formatsOf(membersOf(state, group)));
  return [...wanted.values()];
};

const answerFor = (state: State, formats: Format[]): TargetsResult | undefined =>
  state.targets.status === 'ready' ? state.targets.byKey.get(targetsKey(formats)) : undefined;

export const choiceOf = (state: State, id: string): Choice => state.choices.get(id) ?? NO_CHOICE;

/** Everything a single file can become, ready or locked. Absent formats are not possible for it. */
export const rowTargets = (state: State, file: DetectResult): TargetOption[] =>
  file.format === null ? [] : (answerFor(state, [file.format])?.convert ?? []);

export const groupOutputs = (state: State, group: MergeGroup): MergeChoice[] =>
  answerFor(state, formatsOf(membersOf(state, group)))?.merge ?? [];

export const selectedOption = (state: State, file: DetectResult): TargetOption | undefined =>
  rowTargets(state, file).find((option) => option.format === choiceOf(state, file.path).target);

export const selectedMerge = (state: State, group: MergeGroup): MergeChoice | undefined =>
  groupOutputs(state, group).find((merge) => merge.output === choiceOf(state, group.id).target);

/** The option keys the row's route honours; a merge has none. */
export const visibleOptions = (state: State, file: DetectResult): OptionKey[] =>
  selectedOption(state, file)?.options ?? [];

/** Keys honoured by at least one row, for the "Options for all" button. */
export const batchOptionKeys = (state: State): OptionKey[] => [
  ...new Set(singleFiles(state).flatMap((file) => visibleOptions(state, file))),
];

export const jobOf = (state: State, id: string): Job | undefined => {
  const jobId = state.fileJobs.get(id);
  return jobId === undefined ? undefined : state.jobs.get(jobId);
};

/** The lifecycle of UI-DESIGN section 5. */
export type RowState =
  'detecting' | 'unsupported' | 'ready' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export const rowState = (state: State, id: string): RowState => {
  if (state.detecting.includes(id)) return 'detecting';
  const job = jobOf(state, id);
  if (job !== undefined) return job.state;
  const file = state.files.find((candidate) => candidate.path === id);
  return file !== undefined && !isSupported(file) ? 'unsupported' : 'ready';
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

const onlyVisible = (options: ConvertOptions, visible: OptionKey[]): ConvertOptions => {
  const wanted = new Set<string>(visible);
  return Object.fromEntries(Object.entries(options).filter(([key]) => wanted.has(key)));
};

export interface PlannedJob {
  /** The file path or group id whose row shows this job. */
  owner: string;
  request: JobRequest;
}

/** One request per row that has a ready target and no job yet, and one per ready merge group. */
export const plannedJobs = (state: State): PlannedJob[] => {
  const planned: PlannedJob[] = [];
  for (const file of singleFiles(state)) {
    const { target, options } = choiceOf(state, file.path);
    const option = selectedOption(state, file);
    if (rowState(state, file.path) !== 'ready' || target === null || option?.status !== 'ready')
      continue;
    if (!pagesValid(options.pages ?? '')) continue;
    planned.push({
      owner: file.path,
      request: {
        kind: 'convert',
        input: file.path,
        target,
        options: onlyVisible(options, option.options),
      },
    });
  }
  for (const group of state.groups) {
    const merge = selectedMerge(state, group);
    if (rowState(state, group.id) !== 'ready' || merge?.status !== 'ready') continue;
    planned.push({
      owner: group.id,
      request: {
        kind: 'merge',
        inputs: group.members,
        combinerId: merge.combinerId,
        options: {},
      },
    });
  }
  return planned;
};

export const readyCount = (state: State): number => plannedJobs(state).length;

/** Why Convert is unavailable, as the suffix of a `convert.reason.*` text key. */
export type ConvertBlocker = 'core' | 'detecting' | 'locked' | 'nothing';

export const convertBlocker = (state: State): ConvertBlocker | undefined => {
  if (state.core.status !== 'ready') return 'core';
  if (state.detecting.length > 0) return 'detecting';
  if (readyCount(state) > 0) return undefined;
  const lockedRow = singleFiles(state).some(
    (file) =>
      rowState(state, file.path) === 'ready' &&
      selectedOption(state, file)?.status === 'needs-pack',
  );
  return lockedRow ? 'locked' : 'nothing';
};

export interface BatchSummary {
  total: number;
  counts: Record<Job['state'], number>;
  /** Something is still queued or running. */
  active: boolean;
  /** Something has ended, so Clear finished has work to do. */
  finished: boolean;
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
  return {
    total: state.jobs.size,
    counts,
    active: counts.queued + counts.running > 0,
    finished: [...state.jobs.values()].some((job) => isTerminal(job.state)),
  };
};
