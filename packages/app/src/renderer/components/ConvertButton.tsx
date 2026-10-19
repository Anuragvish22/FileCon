import { canConvert } from '../store/selectors.ts';
import { useStore } from '../store/context.tsx';

export const ConvertButton = () => {
  const { state, actions, translate } = useStore();
  return (
    <button
      type="button"
      className="primary"
      disabled={!canConvert(state)}
      onClick={() => void actions.submit()}
    >
      {translate('convert.button')}
    </button>
  );
};
