import { useStore } from '../store/context.tsx';
import { groupOf } from '../store/selectors.ts';
import { DetectingRow, FileRow } from './FileRow.tsx';
import { MergeGroup } from './MergeGroup.tsx';

/** Rows in list order, with each merge group standing where its first member is. */
export const FileList = () => {
  const { state, actions, translate } = useStore();
  const shown = new Set<string>();
  const items = state.files.flatMap((file, index) => {
    const group = groupOf(state, file.id);
    if (group !== undefined) {
      if (shown.has(group.id)) return [];
      shown.add(group.id);
      return [<MergeGroup key={group.id} group={group} />];
    }
    // Neighbours are other single rows: Alt+Arrow jumps over a group so it stays in one piece.
    const step = (direction: -1 | 1): number => {
      for (let at = index + direction; at >= 0 && at < state.files.length; at += direction) {
        const neighbour = state.files[at];
        if (neighbour !== undefined && groupOf(state, neighbour.id) === undefined) return at;
      }
      return index;
    };
    return [
      <FileRow
        key={file.id}
        file={file}
        onMove={(direction) => {
          const to = step(direction);
          if (to !== index) actions.moveFile({ from: index, to });
        }}
        onDropRow={(fromId) => {
          const from = state.files.findIndex((candidate) => candidate.id === fromId);
          if (from >= 0 && from !== index) actions.moveFile({ from, to: index });
        }}
      />,
    ];
  });
  return (
    <ul
      aria-label={translate('files.list')}
      className="rounded-card border border-border bg-surface-raised"
    >
      {items}
      {state.detecting.map((path, index) => (
        <DetectingRow key={`${path}#${index}`} path={path} />
      ))}
    </ul>
  );
};
