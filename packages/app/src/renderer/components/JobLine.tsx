import type { Job } from '@filecon/core/types';
import { Ban, CircleCheck, CircleX, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { baseName } from '../format.ts';
import { useStore } from '../store/context.tsx';
import { Button } from './ui/Button.tsx';
import { Progress } from './ui/Progress.tsx';
import { useThrottled } from './useThrottled.ts';

const MS_PER_SECOND = 1000;
const FRACTION_TO_PERCENT = 100;
const ICON_SIZE = 16;
const ANNOUNCE_INTERVAL_MS = 100; // UI-DESIGN section 7: a row's status text updates at most 10 times a second

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

/**
 * The second part of a row once it has a job: progress while it runs, then the result with its
 * buttons (UI-DESIGN section 3). Used by single rows and merge groups alike.
 */
export const JobLine = ({ job }: { job: Job }) => {
  const { state, actions, translate } = useStore();
  const elapsed = useElapsed(job);
  const [details, setDetails] = useState<'shown' | 'hidden'>('hidden');
  const { fraction, unit, total } = job.progress;
  const percent = fraction === null ? null : Math.round(fraction * FRACTION_TO_PERCENT);
  const status = useThrottled(
    job.state === 'running'
      ? percent === null
        ? translate('job.working')
        : `${percent}%`
      : translate(`job.state.${job.state}`),
    ANNOUNCE_INTERVAL_MS,
  );
  const canRetry = state.requests.has(job.id);
  const first = job.outputs[0];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span role="status" aria-live="polite" className="flex items-center gap-1">
        {job.state === 'done' && <CircleCheck size={ICON_SIZE} aria-hidden="true" />}
        {job.state === 'failed' && <CircleX size={ICON_SIZE} aria-hidden="true" />}
        {job.state === 'cancelled' && <Ban size={ICON_SIZE} aria-hidden="true" />}
        {job.state === 'done' && first !== undefined ? baseName(first) : status}
      </span>
      {job.state === 'running' && (
        <>
          <Progress fraction={fraction} label={status} className="min-w-32 flex-1" />
          {total > 1 && <span>{translate('job.step', { unit, total })}</span>}
          {elapsed !== undefined && <span>{translate('job.elapsed', { seconds: elapsed })}</span>}
        </>
      )}
      {job.state === 'failed' && job.error !== undefined && (
        <span role="alert">{translate(`error.${job.error.code}`, job.error.params)}</span>
      )}
      {job.state === 'done' &&
        job.notes.map((note) => <span key={note}>{translate(`lossy.${note}`)}</span>)}
      {(job.state === 'queued' || job.state === 'running') && (
        <Button
          size="icon"
          variant="ghost"
          aria-label={translate('job.cancel')}
          onClick={() => void actions.cancel(job.id)}
        >
          <X size={ICON_SIZE} aria-hidden="true" />
        </Button>
      )}
      {job.state === 'done' && first !== undefined && (
        <Button size="sm" onClick={() => void actions.reveal(first)}>
          {translate(job.outputs.length > 1 ? 'job.openFolder' : 'job.show')}
        </Button>
      )}
      {job.state === 'failed' && job.error?.detail !== undefined && (
        <Button size="sm" onClick={() => setDetails(details === 'shown' ? 'hidden' : 'shown')}>
          {translate('job.details')}
        </Button>
      )}
      {(job.state === 'failed' || job.state === 'cancelled') && canRetry && (
        <Button size="sm" onClick={() => void actions.retry(job.id)}>
          {translate('job.retry')}
        </Button>
      )}
      {details === 'shown' && (
        <pre className="w-full overflow-auto rounded-control bg-surface p-2 font-mono text-sm">
          {job.error?.detail}
        </pre>
      )}
    </div>
  );
};
