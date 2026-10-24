import { useStore } from '../store/context.tsx';
import { Button } from './ui/Button.tsx';
import { RadioGroup } from './ui/RadioGroup.tsx';

/** Where converted files go: beside the source, or in one chosen folder. */
export const OutputChooser = () => {
  const { state, actions, translate } = useStore();
  const { settings } = state;
  if (settings === null) return null;
  const { mode, dir } = settings.output;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="font-medium">{translate('output.label')}</span>
      <RadioGroup
        label={translate('output.label')}
        value={mode}
        onValueChange={(next) => {
          if (next === 'source') void actions.setSettings({ output: { mode: 'source' } });
          else void actions.chooseOutputDir();
        }}
        options={[
          { value: 'source', label: translate('output.source') },
          {
            value: 'custom',
            label:
              dir === undefined
                ? translate('output.custom')
                : translate('output.customAt', { dir }),
          },
        ]}
      />
      {mode === 'custom' && (
        <Button size="sm" onClick={() => void actions.chooseOutputDir()}>
          {translate('output.change')}
        </Button>
      )}
    </div>
  );
};
