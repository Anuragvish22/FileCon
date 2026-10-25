import type { Job } from '@filecon/core/types';
import { Circle, CircleCheck, GripVertical, Loader, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { baseName, humanSize } from '../format.ts';
import { useStore } from '../store/context.tsx';
import type { MergeGroup as Group } from '../store/state.ts';
import { choiceOf, groupOutputs, jobOf, membersOf, rowState } from '../store/selectors.ts';
import { FileIcon } from './FileIcon.tsx';
import { ROW_TYPE } from './FileRow.tsx';
import { FormatPopover } from './FormatPopover.tsx';
import { JobLine } from './JobLine.tsx';
import { Button } from './ui/Button.tsx';

const ICON_SIZE = 16;

/** A member while the group runs: done, current or waiting, from the group's `progress.unit` alone. */
const MemberMark = ({ index, job }: { index: number; job: Job }) => {
  const { translate } = useStore();
  const step = index + 1;
  if (step < job.progress.unit)
    return <CircleCheck size={ICON_SIZE} aria-label={translate('merge.member.done')} />;
  if (step === job.progress.unit)
    return (
      <Loader
        size={ICON_SIZE}
        className="animate-spin"
        aria-label={translate('merge.member.current')}
      />
    );
  return <Circle size={ICON_SIZE} aria-label={translate('merge.member.waiting')} />;
};

/**
 * Several files that become one output (UI-DESIGN section 3). Ready: a header with the target and the
 * members in page order. Running: one bar. Ended: one result row.
 */
export const MergeGroup = ({ group }: { group: Group }) => {
  const { state, actions, translate } = useStore();
  const phase = rowState(state, group.id);
  const job = jobOf(state, group.id);
  const members = membersOf(state, group);
  const choice = choiceOf(state, group.id);
  const busy = state.submit === 'busy';
  const coreDown = state.core.status !== 'ready';
  const ended = phase === 'done' || phase === 'failed' || phase === 'cancelled';

  const onKeyDown = (index: number) => (event: KeyboardEvent) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    const to = event.key === 'ArrowUp' ? index - 1 : index + 1;
    if (to < 0 || to >= members.length) return;
    event.preventDefault();
    actions.moveMember({ id: group.id, from: index, to });
  };

  return (
    <li
      className="grid gap-2 border-b border-border p-3"
      data-state={phase}
      aria-busy={busy || undefined}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{translate('merge.title')}</span>
        {phase === 'ready' && (
          <>
            <FormatPopover
              title={translate('merge.title')}
              from={members.map((member) => member.format ?? '').join(', ')}
              value={choice.target}
              offers={groupOutputs(state, group).map((merge) => ({
                format: merge.output,
                status: merge.status,
                ...(merge.pack === undefined ? {} : { pack: merge.pack }),
                lossy: [],
              }))}
              unavailable={busy || coreDown}
              onPick={(format) => actions.pickTarget(group.id, format)}
            />
            <Button size="sm" onClick={() => actions.unmerge(group.id)}>
              {translate('merge.unmerge')}
            </Button>
          </>
        )}
        {ended && <span>{translate('merge.files', { count: members.length })}</span>}
      </div>
      {job !== undefined && <JobLine job={job} />}
      {!ended && (
        <ul className="grid gap-1">
          {members.map((member, index) => (
            <li
              key={member.id}
              className="flex items-center gap-3"
              tabIndex={0}
              onKeyDown={onKeyDown(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                if (!event.dataTransfer.types.includes(ROW_TYPE)) return;
                event.preventDefault();
                const from = group.members.indexOf(event.dataTransfer.getData(ROW_TYPE));
                if (from >= 0 && from !== index)
                  actions.moveMember({ id: group.id, from, to: index });
              }}
            >
              {phase === 'ready' ? (
                <span
                  draggable
                  aria-hidden="true"
                  onDragStart={(event) => event.dataTransfer.setData(ROW_TYPE, member.id)}
                >
                  <GripVertical size={ICON_SIZE} />
                </span>
              ) : job !== undefined ? (
                <MemberMark index={index} job={job} />
              ) : null}
              <FileIcon format={member.format} />
              <span className="min-w-0 flex-1 truncate">{baseName(member.path)}</span>
              <span className="text-muted">{humanSize(member.size)}</span>
              {member.format !== null && <span>{translate(`format.${member.format}`)}</span>}
              {phase === 'ready' && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={translate('file.remove', { name: baseName(member.path) })}
                  onClick={() => actions.removeFile(member.id)}
                >
                  <X size={ICON_SIZE} aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};
