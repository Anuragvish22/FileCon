import { mergeChoice } from '../store/selectors.ts';
import { useStore } from '../store/context.tsx';

/** UI-DESIGN section 4: shown for 2 or more files, or one file whose route fans out. */
export const MergeToggle = () => {
  const { state, actions, translate } = useStore();
  const choice = mergeChoice(state);
  if (choice === undefined) return null;
  return (
    <label>
      <input
        type="checkbox"
        checked={state.selection.mergeMode}
        onChange={(event) => actions.setMerge(event.target.checked)}
      />
      <span>{translate('merge.toggle')}</span>
      {choice.status === 'needs-pack' && (
        <span>
          {translate('target.locked', { pack: translate(`pack.${choice.pack ?? 'builtin'}`) })}
        </span>
      )}
    </label>
  );
};
