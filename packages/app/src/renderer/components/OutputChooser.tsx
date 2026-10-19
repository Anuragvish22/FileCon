import { useStore } from '../store/context.tsx';

export const OutputChooser = () => {
  const { state, actions, translate } = useStore();
  const { settings } = state;
  if (settings === null) return null;
  const { mode, dir } = settings.output;
  return (
    <fieldset>
      <legend>{translate('output.label')}</legend>
      <label>
        <input
          type="radio"
          name="output"
          checked={mode === 'source'}
          onChange={() => void actions.setSettings({ output: { mode: 'source' } })}
        />
        <span>{translate('output.source')}</span>
      </label>
      <label>
        <input
          type="radio"
          name="output"
          checked={mode === 'custom'}
          onChange={() => void actions.chooseOutputDir()}
        />
        <span>
          {dir === undefined ? translate('output.custom') : translate('output.customAt', { dir })}
        </span>
      </label>
      {mode === 'custom' && (
        <button type="button" onClick={() => void actions.chooseOutputDir()}>
          {translate('output.change')}
        </button>
      )}
    </fieldset>
  );
};
