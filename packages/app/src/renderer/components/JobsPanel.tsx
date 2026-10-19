import type { Job } from '@filecon/core/types';
import { useEffect, useState } from 'react';
import { batchSummary } from '../store/selectors.ts';
import { useStore } from '../store/context.tsx';
import { useThrottled } from './useThrottled.ts';

const ANNOUNCE_INTERVAL_MS = 1000;
const MS_PER_SECOND = 1000;
const FRACTION_TO_PERCENT = 100;

const baseName = (path: string): string => path.split(/[\\/]/).pop() ?? path;

const STATE_ICON: Record<Job['state'], string> = {
  queued: '…',
  running: '⟳',
  done: '✓',
  failed: '✗',
  cancelled: '⊘',
};

/** Whole seconds since the job started, ticking once a second while it runs. */
const useElapsed = (job: Job): number | undefined => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (job.state !== 'running') return undefined;
    const timer = setInterval(() => setNow(Date.now()), MS_PER_SECOND);
    return () => clearInterval(timer);
  }, [job.state]);
  return job.startedAt === undefined || job.state !== 'running'
    ? undefined
    : Math.max(0, Math.floor((now - job.startedAt) / MS_PER_SECOND));
};

const JobRow = ({ job }: { job: Job }) => {
  const { state, actions, translate } = useStore();
  const elapsed = useElapsed(job);
  const [details, setDetails] = useState<'shown' | 'hidden'>('hidden');
  const name = job.kind === 'merge' ? translate('job.merged') : baseName(job.inputs[0] ?? '');
  const { fraction, unit, total } = job.progress;
  const canRetry = state.requests.has(job.id);
  return (
    <li className="job-row" data-state={job.state}>
      <span aria-hidden="true">{STATE_ICON[job.state]}</span>
      <span className="job-name">{name}</span>
      <span>{translate(`job.state.${job.state}`)}</span>
      {job.state === 'running' && (
        <>
          <span>{translate('job.step', { unit, total })}</span>
          {fraction === null ? (
            <progress aria-label={translate('job.working')} />
          ) : (
            <progress
              max={1}
              value={fraction}
              aria-label={`${Math.round(fraction * FRACTION_TO_PERCENT)}%`}
            />
          )}
          {elapsed !== undefined && <span>{translate('job.elapsed', { seconds: elapsed })}</span>}
        </>
      )}
      {job.state === 'failed' && job.error !== undefined && (
        <span role="alert">{translate(`error.${job.error.code}`, job.error.params)}</span>
      )}
      {job.state === 'done' &&
        job.notes.map((note) => <span key={note}>{translate(`lossy.${note}`)}</span>)}
      {(job.state === 'queued' || job.state === 'running') && (
        <button type="button" onClick={() => void actions.cancel(job.id)}>
          {translate('job.cancel')}
        </button>
      )}
      {job.state === 'done' && job.outputs[0] !== undefined && (
        <button type="button" onClick={() => void actions.reveal(job.outputs[0] ?? '')}>
          {translate(job.outputs.length > 1 ? 'job.openFolder' : 'job.show')}
        </button>
      )}
      {job.state === 'failed' && job.error?.detail !== undefined && (
        <button type="button" onClick={() => setDetails(details === 'shown' ? 'hidden' : 'shown')}>
          {translate('job.details')}
        </button>
      )}
      {(job.state === 'failed' || job.state === 'cancelled') && canRetry && (
        <button type="button" onClick={() => void actions.retry(job.id)}>
          {translate('job.retry')}
        </button>
      )}
      {details === 'shown' && <pre className="job-details">{job.error?.detail}</pre>}
    </li>
  );
};

/** UI-DESIGN sections 3 and 5: docked under the Convert page, only when jobs exist. */
export const JobsPanel = () => {
  const { state, actions, translate } = useStore();
  const summary = batchSummary(state);
  const announcement = useThrottled(
    translate('jobs.summary', {
      done: summary.counts.done,
      failed: summary.counts.failed,
      active: summary.counts.queued + summary.counts.running,
    }),
    ANNOUNCE_INTERVAL_MS,
  );
  if (summary.total === 0) return null;
  return (
    <section className="jobs" aria-label={translate('jobs.title')}>
      <h2>{translate('jobs.title')}</h2>
      {/* Throttled, so a fast batch is read out about once a second, not on every progress tick. */}
      <div role="status" aria-live="polite" className="visually-hidden">
        {announcement}
      </div>
      <ul>
        {[...state.jobs.values()].map((job) => (
          <JobRow key={job.id} job={job} />
        ))}
      </ul>
      <div>
        {summary.active && (
          <button type="button" onClick={() => void actions.cancelAll()}>
            {translate('jobs.cancelAll')}
          </button>
        )}
        <button type="button" onClick={actions.clearFinished}>
          {translate('jobs.clear')}
        </button>
      </div>
    </section>
  );
};
