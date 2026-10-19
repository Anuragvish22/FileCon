import { canConvert } from '../store/selectors.ts';
import { useStore } from '../store/context.tsx';

export const ConvertButton = () => {
  const { state, actions, translate } = useStore();
  return (
    <button
      type="button"
      className="primary"
      disabled={!canConvert(state) || state.submit === 'busy'}
      onClick={() => void actions.submit()}
    >
      {translate(state.submit === 'busy' ? 'convert.busy' : 'convert.button')}
    </button>
  );
};
