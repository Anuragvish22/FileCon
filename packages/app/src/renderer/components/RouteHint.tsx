import { needsFontNote } from '../format.ts';
import { inputFormats, selectedTarget } from '../store/selectors.ts';
import { useStore } from '../store/context.tsx';

/** UI-DESIGN section 4, "Lossy": shown before the user clicks Convert, never blocking. */
export const RouteHint = () => {
  const { state, translate } = useStore();
  const target = selectedTarget(state);
  if (target === undefined) return null;
  const lossy = target.lossy.map((id) => translate(`lossy.${id}`));
  const fonts = needsFontNote(inputFormats(state), state.selection.target);
  if (lossy.length === 0 && !fonts) return null;
  return (
    <div className="route-hint">
      {lossy.length > 0 && <p>{translate('hint.lossy', { notes: lossy.join(', ') })}</p>}
      {fonts && <p>{translate('hint.fonts')}</p>}
    </div>
  );
};
