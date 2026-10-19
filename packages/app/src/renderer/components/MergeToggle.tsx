import { mergeChoice } from '../store/selectors.ts';
import { useStore } from '../store/context.tsx';

/** UI-DESIGN section 4: shown for 2 or more files, or one file whose route fans out. */
export const MergeToggle = () => {
  const { state, actions, translate } = useStore();
  const choice = mergeChoice(state);
  if (choice === undefined) return null;
  // A locked merge leads to Engines like a locked single-file target (UI-DESIGN section 3).
  if (choice.status === 'needs-pack')
    return (
      <button type="button" onClick={() => actions.setPage('engines')}>
        {translate('target.locked', { pack: translate(`pack.${choice.pack ?? 'builtin'}`) })}
      </button>
    );
  return (
    <label>
      <input
        type="checkbox"
        checked={state.selection.mergeMode}
        onChange={(event) => actions.setMerge(event.target.checked)}
      />
      <span>{translate('merge.toggle')}</span>
    </label>
  );
};
