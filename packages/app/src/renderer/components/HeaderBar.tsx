import type { ConvertOptions, Format } from '@filecon/core/types';
import { useState } from 'react';
import { useStore } from '../store/context.tsx';
import {
  MIN_GROUP_SIZE,
  batchOptionKeys,
  batchSummary,
  rowState,
  rowTargets,
  singleFiles,
} from '../store/selectors.ts';
import { FormatPopover, type FormatOffer } from './FormatPopover.tsx';
import { RowOptions } from './RowOptions.tsx';
import { Button } from './ui/Button.tsx';

/**
 * What the whole batch can become: a format is offered when any ready row can make it, and is locked only
 * if every such row needs a pack.
 */
const batchOffers = (offersPerRow: FormatOffer[][]): FormatOffer[] => {
  const merged = new Map<Format, FormatOffer>();
  for (const offer of offersPerRow.flat()) {
    const seen = merged.get(offer.format);
    if (seen === undefined || (seen.status === 'needs-pack' && offer.status === 'ready'))
      merged.set(offer.format, offer);
  }
  return [...merged.values()];
};

/** Counts and the batch-wide actions (UI-DESIGN section 3). Hidden while there are no files. */
export const HeaderBar = () => {
  const { state, actions, translate } = useStore();
  const [batchOptions, setBatchOptions] = useState<ConvertOptions>({});
  const summary = batchSummary(state);
  const total = state.files.length + state.detecting.length;
  if (total === 0) return null;

  const ready = singleFiles(state).filter((file) => rowState(state, file.path) === 'ready');
  const offers = batchOffers(ready.map((file) => rowTargets(state, file)));
  const formats = [
    ...new Set(ready.flatMap((file) => (file.format === null ? [] : [file.format]))),
  ];
  const idle = state.submit !== 'busy' && state.core.status === 'ready';

  const counts = summary.active
    ? translate('header.running', { count: summary.counts.queued + summary.counts.running })
    : summary.total > 0
      ? translate('header.finished', {
          done: summary.counts.done,
          failed: summary.counts.failed,
          cancelled: summary.counts.cancelled,
        })
      : translate('files.title', { count: total });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span role="status" className="text-base font-semibold">
        {counts}
      </span>
      {ready.length > 0 && (
        <>
          <span className="text-muted">{translate('header.convertAll')}</span>
          <FormatPopover
            title={translate('header.batch')}
            from={formats.map((format) => translate(`format.${format}`)).join(', ')}
            value={null}
            offers={offers}
            unavailable={!idle}
            onPick={actions.pickTargetForAll}
          />
          <RowOptions
            title={translate('header.batch')}
            keys={batchOptionKeys(state)}
            options={batchOptions}
            unavailable={!idle}
            onChange={(key, value) =>
              setBatchOptions((current) => {
                const next = { ...current };
                if (value === undefined) delete next[key];
                else Object.assign(next, { [key]: value });
                return next;
              })
            }
            onReset={() => setBatchOptions({})}
            onApplyToAll={() => actions.applyOptionsToAll(batchOptions)}
          />
          <Button
            unavailable={!idle || ready.length < MIN_GROUP_SIZE}
            reason={translate('merge.needTwo')}
            onClick={() => actions.mergeFiles(ready.map((file) => file.path))}
          >
            {translate('merge.button')}
          </Button>
        </>
      )}
      <span className="flex-1" />
      {summary.active && (
        <Button variant="danger" onClick={() => void actions.cancelAll()}>
          {translate('jobs.cancelAll')}
        </Button>
      )}
      {summary.finished && (
        <Button variant="ghost" onClick={actions.clearFinished}>
          {translate('jobs.clear')}
        </Button>
      )}
      <Button
        variant="ghost"
        unavailable={summary.active}
        reason={translate('files.clear.running')}
        onClick={actions.clearFiles}
      >
        {translate('files.clear')}
      </Button>
    </div>
  );
};
