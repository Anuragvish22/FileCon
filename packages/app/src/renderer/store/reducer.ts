import type {
  CoreError,
  CoreStatus,
  DetectResult,
  EngineInfo,
  ConvertOptions,
  Format,
  Job,
  JobRequest,
  OptionKey,
  Settings,
  TargetsResult,
} from '@filecon/core/types';
import { isTerminal } from '@filecon/core/types';
import type { Choice, MergeGroup, Notice, Page, State } from './state.ts';
import {
  MIN_GROUP_SIZE,
  choiceOf,
  groupOutputs,
  isSupported,
  jobOf,
  rowState,
  rowTargets,
  singleFiles,
  visibleOptions,
} from './selectors.ts';
import { initialState } from './state.ts';

export type Action =
  | { type: 'core/status'; status: CoreStatus; restarts: number }
  | { type: 'paths/queued'; paths: string[] }
  | { type: 'paths/dequeued' }
  | { type: 'files/detecting'; paths: string[] }
  | { type: 'files/added'; results: DetectResult[] }
  | { type: 'files/removed'; path: string }
  | { type: 'files/moved'; from: number; to: number }
  | { type: 'files/cleared' }
  | { type: 'targets/loading' }
  | { type: 'targets/loaded'; byKey: Map<string, TargetsResult> }
  | { type: 'targets/failed'; error: CoreError }
  | { type: 'row/target'; id: string; target: Format | null }
  | { type: 'row/option'; id: string; key: OptionKey; value: unknown }
  | { type: 'row/reset'; id: string }
  | { type: 'all/target'; target: Format }
  | { type: 'all/options'; options: ConvertOptions }
  | { type: 'group/created'; paths: string[] }
  | { type: 'group/dissolved'; id: string }
  | { type: 'group/moved'; id: string; from: number; to: number }
  | { type: 'submit/started' }
  | { type: 'submit/finished'; owners: string[]; jobIds: string[]; requests: JobRequest[] }
  | { type: 'submit/failed' }
  | { type: 'jobs/updated'; job: Job }
  | { type: 'jobs/cleared' }
  | { type: 'engines/loaded'; engines: EngineInfo[] }
  | { type: 'settings/loaded'; settings: Settings }
  | { type: 'page/set'; page: Page }
  | { type: 'notice/set'; notice: Notice }
  | { type: 'notice/dismissed' };

const withChoice = (state: State, id: string, change: Partial<Choice>): Map<string, Choice> =>
  new Map(state.choices).set(id, { ...choiceOf(state, id), ...change });

/** Drops everything that belongs to the given files or groups, keeping the rest. */
const forget = (state: State, ids: Set<string>): State => {
  const groups = state.groups.filter((group) => !ids.has(group.id));
  const members = new Set(
    state.groups.filter((group) => ids.has(group.id)).flatMap((group) => group.members),
  );
  const gone = (id: string): boolean => ids.has(id) || members.has(id);
  return {
    ...state,
    files: state.files.filter((file) => !gone(file.path)),
    groups,
    choices: new Map([...state.choices].filter(([id]) => !gone(id))),
    fileJobs: new Map([...state.fileJobs].filter(([id]) => !gone(id))),
    // Counts come from the jobs, so a cleared row's job must go too or it keeps being counted.
    jobs: new Map(
      [...state.jobs].filter(
        ([jobId]) => ![...state.fileJobs].some(([id, mapped]) => mapped === jobId && gone(id)),
      ),
    ),
  };
};

/** A group of fewer than two files is no group: its remaining file goes back to being a row. */
const prune = (groups: MergeGroup[]): { kept: MergeGroup[]; dropped: string[] } => ({
  kept: groups.filter((group) => group.members.length >= MIN_GROUP_SIZE),
  dropped: groups.filter((group) => group.members.length < MIN_GROUP_SIZE).map((group) => group.id),
});

/**
 * After new answers from core: a target that is no longer possible is cleared, and an empty row starts
 * with the last target picked for its format when that is still offered (UI-DESIGN section 4).
 */
const reconcile = (state: State): State => {
  const choices = new Map(state.choices);
  for (const file of singleFiles(state)) {
    if (!isSupported(file) || file.format === null) continue;
    const offered = rowTargets(state, file).map((option) => option.format);
    const current = choiceOf(state, file.path);
    let target =
      current.target !== null && offered.includes(current.target) ? current.target : null;
    const remembered = state.lastTargets[file.format];
    if (target === null && remembered !== undefined && offered.includes(remembered))
      target = remembered;
    if (target !== current.target) choices.set(file.path, { ...current, target });
  }
  for (const group of state.groups) {
    const outputs = groupOutputs(state, group);
    const current = choiceOf(state, group.id);
    const kept = outputs.some((merge) => merge.output === current.target);
    const target = kept ? current.target : (outputs[0]?.output ?? null);
    if (target !== current.target) choices.set(group.id, { ...current, target });
  }
  return { ...state, choices };
};

const setOption = (options: ConvertOptions, key: OptionKey, value: unknown): ConvertOptions => {
  const next = { ...options };
  if (value === undefined) delete next[key];
  else Object.assign(next, { [key]: value });
  return next;
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'core/status':
      return { ...state, core: { status: action.status, restarts: action.restarts } };
    case 'paths/queued':
      return { ...state, queuedPaths: [...state.queuedPaths, ...action.paths] };
    case 'paths/dequeued':
      return { ...state, queuedPaths: [] };
    case 'files/detecting':
      return { ...state, detecting: [...state.detecting, ...action.paths] };
    case 'files/added': {
      const known = new Set(state.files.map((file) => file.path));
      const fresh = action.results.filter((result) => !known.has(result.path));
      const done = new Set(action.results.map((result) => result.path));
      return {
        ...state,
        files: [...state.files, ...fresh],
        detecting: state.detecting.filter((path) => !done.has(path)),
      };
    }
    case 'files/removed': {
      const shrunk = state.groups.map((group) => ({
        ...group,
        members: group.members.filter((path) => path !== action.path),
      }));
      // A group left with one file stops being a group, and that file stays as a row.
      const { kept, dropped } = prune(shrunk);
      const gone = (id: string): boolean => id === action.path || dropped.includes(id);
      return {
        ...state,
        files: state.files.filter((file) => file.path !== action.path),
        groups: kept,
        choices: new Map([...state.choices].filter(([id]) => !gone(id))),
        fileJobs: new Map([...state.fileJobs].filter(([id]) => !gone(id))),
      };
    }
    case 'files/moved': {
      const files = [...state.files];
      const [moved] = files.splice(action.from, 1);
      if (moved === undefined) return state;
      files.splice(action.to, 0, moved);
      return { ...state, files };
    }
    case 'files/cleared': {
      // Rows with a job still queued or running stay: they have something to show and to cancel.
      const active = (id: string): boolean => {
        const job = jobOf(state, id);
        return job !== undefined && !isTerminal(job.state);
      };
      const ids = new Set([
        ...state.files.map((file) => file.path),
        ...state.groups.map((group) => group.id),
      ]);
      const stay = new Set(
        [...ids].filter(
          (id) =>
            active(id) ||
            (state.groups.find((group) => group.id === id)?.members ?? []).some(active),
        ),
      );
      const cleared = forget(state, new Set([...ids].filter((id) => !stay.has(id))));
      return {
        ...cleared,
        detecting: [],
        targets: cleared.files.length === 0 ? { status: 'idle' } : state.targets,
      };
    }
    case 'targets/loading':
      return { ...state, targets: { status: 'loading' } };
    case 'targets/loaded':
      return reconcile({ ...state, targets: { status: 'ready', byKey: action.byKey } });
    case 'targets/failed':
      return { ...state, targets: { status: 'failed', error: action.error } };
    case 'row/target': {
      const file = state.files.find((candidate) => candidate.path === action.id);
      const remember =
        file?.format != null && action.target !== null
          ? { lastTargets: { ...state.lastTargets, [file.format]: action.target } }
          : {};
      return {
        ...state,
        ...remember,
        choices: withChoice(state, action.id, { target: action.target }),
      };
    }
    case 'row/option':
      return {
        ...state,
        choices: withChoice(state, action.id, {
          options: setOption(choiceOf(state, action.id).options, action.key, action.value),
        }),
      };
    case 'row/reset':
      return { ...state, choices: withChoice(state, action.id, { options: {} }) };
    case 'all/target': {
      const choices = new Map(state.choices);
      const lastTargets = { ...state.lastTargets };
      for (const file of singleFiles(state)) {
        const offered = rowTargets(state, file).some((option) => option.format === action.target);
        if (!offered || rowState(state, file.path) !== 'ready' || file.format === null) continue;
        choices.set(file.path, { ...choiceOf(state, file.path), target: action.target });
        lastTargets[file.format] = action.target;
      }
      return { ...state, choices, lastTargets };
    }
    case 'all/options': {
      // A key is copied only to rows whose route honours it; the others are skipped by design (P53).
      const choices = new Map(state.choices);
      for (const file of singleFiles(state)) {
        if (rowState(state, file.path) !== 'ready') continue;
        const honoured = new Set<string>(visibleOptions(state, file));
        const current = choiceOf(state, file.path);
        const options = { ...current.options };
        for (const [key, value] of Object.entries(action.options))
          if (honoured.has(key)) Object.assign(options, { [key]: value });
        choices.set(file.path, { ...current, options });
      }
      return { ...state, choices };
    }
    case 'group/created': {
      const grouped = new Set(state.groups.flatMap((group) => group.members));
      const members = action.paths.filter(
        (path) =>
          !grouped.has(path) && state.files.some((file) => file.path === path && isSupported(file)),
      );
      if (members.length < MIN_GROUP_SIZE) return state;
      return {
        ...state,
        groups: [...state.groups, { id: `group-${state.nextGroup}`, members }],
        nextGroup: state.nextGroup + 1,
      };
    }
    case 'group/dissolved':
      return {
        ...state,
        groups: state.groups.filter((group) => group.id !== action.id),
        choices: new Map([...state.choices].filter(([id]) => id !== action.id)),
      };
    case 'group/moved': {
      const groups = state.groups.map((group) => {
        if (group.id !== action.id) return group;
        const members = [...group.members];
        const [moved] = members.splice(action.from, 1);
        if (moved === undefined) return group;
        members.splice(action.to, 0, moved);
        return { ...group, members };
      });
      return { ...state, groups };
    }
    case 'submit/started':
      return { ...state, submit: 'busy' };
    case 'submit/failed':
      return { ...state, submit: 'idle' };
    case 'submit/finished': {
      const requests = new Map(state.requests);
      const fileJobs = new Map(state.fileJobs);
      action.jobIds.forEach((id, index) => {
        const request = action.requests[index];
        const owner = action.owners[index];
        if (request !== undefined) requests.set(id, request);
        if (owner !== undefined) fileJobs.set(owner, id);
      });
      return { ...state, submit: 'idle', requests, fileJobs };
    }
    case 'jobs/updated':
      // Map.set keeps the original position of an existing id, so rows stay in submit order.
      return { ...state, jobs: new Map(state.jobs).set(action.job.id, action.job) };
    case 'jobs/cleared': {
      const ended = new Set(
        [...state.fileJobs]
          .filter(([, jobId]) => {
            const job = state.jobs.get(jobId);
            return job !== undefined && isTerminal(job.state);
          })
          .map(([owner]) => owner),
      );
      const cleared = forget(state, ended);
      return {
        ...cleared,
        jobs: new Map([...state.jobs].filter(([, job]) => !isTerminal(job.state))),
      };
    }
    case 'engines/loaded':
      return { ...state, engines: action.engines };
    case 'settings/loaded':
      return { ...state, settings: action.settings };
    case 'page/set':
      return { ...state, page: action.page };
    case 'notice/set':
      return { ...state, notice: action.notice };
    case 'notice/dismissed':
      return { ...state, notice: null };
  }
};

export { initialState };
