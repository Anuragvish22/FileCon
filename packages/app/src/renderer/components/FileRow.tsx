import type { DetectResult } from '@filecon/core/types';
import { ArrowRight, GripVertical, Info, Loader, TriangleAlert, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { baseName, humanSize, needsFontNote } from '../format.ts';
import { useStore } from '../store/context.tsx';
import {
  choiceOf,
  jobOf,
  rowState,
  rowTargets,
  selectedOption,
  visibleOptions,
} from '../store/selectors.ts';
import { FileIcon } from './FileIcon.tsx';
import { FormatPopover } from './FormatPopover.tsx';
import { JobLine } from './JobLine.tsx';
import { RowOptions } from './RowOptions.tsx';
import { Button } from './ui/Button.tsx';

export const ROW_TYPE = 'application/x-filecon-row';
const ICON_SIZE = 16;

export interface RowProps {
  file: DetectResult;
  /** Move this row one place: -1 up, 1 down. */
  onMove: (direction: -1 | 1) => void;
  /** Dropped on this row by mouse: the path of the row being dragged. */
  onDropRow: (fromPath: string) => void;
}

/** A row whose type is still being detected (P41): a spinner where the type goes. */
export const DetectingRow = ({ path }: { path: string }) => {
  const { translate } = useStore();
  return (
    <li className="flex items-center gap-3 border-b border-border p-3">
      <Loader size={ICON_SIZE} className="animate-spin" aria-hidden="true" />
      <span className="flex-1 truncate">{baseName(path)}</span>
      <span>{translate('file.detecting')}</span>
    </li>
  );
};

/**
 * One file, morphing through its lifecycle (UI-DESIGN section 5): ready with a format select and
 * options, then progress, then the result.
 */
export const FileRow = ({ file, onMove, onDropRow }: RowProps) => {
  const { state, actions, translate } = useStore();
  const name = baseName(file.path);
  const phase = rowState(state, file.path);
  const job = jobOf(state, file.path);
  const choice = choiceOf(state, file.path);
  const option = selectedOption(state, file);
  const busy = state.submit === 'busy';
  const coreDown = state.core.status !== 'ready';
  const from = file.format === null ? '' : translate(`format.${file.format}`);

  // Alt+Up and Alt+Down reorder from the keyboard (UI-DESIGN section 7).
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    onMove(event.key === 'ArrowUp' ? -1 : 1);
  };

  const notes: { key: string; icon: 'warn' | 'info'; text: string }[] = [];
  if (phase === 'ready') {
    if (file.mismatch)
      notes.push({ key: 'mismatch', icon: 'warn', text: translate('file.mismatch.detail') });
    for (const lossy of option?.lossy ?? [])
      notes.push({ key: lossy, icon: 'warn', text: translate(`lossy.${lossy}`) });
    if (file.format !== null && needsFontNote([file.format], choice.target))
      notes.push({ key: 'fonts', icon: 'info', text: translate('hint.fonts') });
  }

  return (
    <li
      className="group grid gap-1 border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface data-[state=done]:bg-success-subtle/40 data-[state=failed]:bg-danger-subtle/40"
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-state={phase}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes(ROW_TYPE)) return;
        event.preventDefault();
        onDropRow(event.dataTransfer.getData(ROW_TYPE));
      }}
    >
      <div className="flex items-center gap-3">
        {phase === 'ready' && (
          <span
            draggable
            aria-hidden="true"
            className="cursor-grab text-muted opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
            onDragStart={(event) => event.dataTransfer.setData(ROW_TYPE, file.path)}
          >
            <GripVertical size={ICON_SIZE} />
          </span>
        )}
        <FileIcon format={file.format} />
        <span className="min-w-0 flex-1 truncate text-base font-medium">{name}</span>
        {phase === 'unsupported' && (
          <span className="flex items-center gap-1 text-danger">
            <TriangleAlert size={ICON_SIZE} aria-hidden="true" />
            {file.error === undefined
              ? translate('file.unsupported')
              : translate(`error.${file.error.code}`, file.error.params)}
          </span>
        )}
        {phase === 'ready' && file.format !== null && (
          <>
            <span className="rounded-control bg-surface px-2 py-0.5 font-mono text-xs">{from}</span>
            <ArrowRight size={ICON_SIZE} aria-hidden="true" className="text-accent" />
            <FormatPopover
              title={name}
              from={from}
              value={choice.target}
              offers={rowTargets(state, file)}
              unavailable={busy || coreDown}
              onPick={(format) => actions.pickTarget(file.path, format)}
            />
            <RowOptions
              title={name}
              keys={visibleOptions(state, file)}
              options={choice.options}
              unavailable={busy || coreDown}
              onChange={(key, value) => actions.setOption(file.path, key, value)}
              onReset={() => actions.resetOptions(file.path)}
              onApplyToAll={() => actions.applyOptionsToAll(choice.options)}
            />
          </>
        )}
        {(phase === 'running' || phase === 'queued') && choice.target !== null && (
          <span className="flex items-center gap-1">
            <ArrowRight size={ICON_SIZE} aria-hidden="true" />
            {translate(`format.${choice.target}`)}
          </span>
        )}
        {phase === 'ready' || phase === 'unsupported' ? (
          <Button
            size="icon"
            variant="ghost"
            className="opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
            aria-label={translate('file.remove', { name })}
            onClick={() => actions.removeFile(file.path)}
          >
            <X size={ICON_SIZE} aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {job === undefined ? (
        <div className="flex flex-col gap-1 ps-14 text-muted">
          <span>{humanSize(file.size)}</span>
          {notes.map((note) => (
            <span key={note.key} className="flex items-center gap-1">
              {note.icon === 'warn' ? (
                <TriangleAlert size={ICON_SIZE} aria-hidden="true" />
              ) : (
                <Info size={ICON_SIZE} aria-hidden="true" />
              )}
              {note.text}
            </span>
          ))}
          {phase === 'ready' && option?.status === 'needs-pack' && option.pack !== undefined && (
            <span>{translate('picker.locked', { pack: translate(`pack.${option.pack}`) })}</span>
          )}
        </div>
      ) : (
        <div className="ps-14">
          <JobLine job={job} />
        </div>
      )}
    </li>
  );
};
