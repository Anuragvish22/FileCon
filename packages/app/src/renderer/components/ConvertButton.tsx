import { convertBlocker, readyCount } from '../store/selectors.ts';
import { useStore } from '../store/context.tsx';
import { Button } from './ui/Button.tsx';

export const ConvertButton = () => {
  const { state, actions, translate } = useStore();
  const blocker = convertBlocker(state);
  const busy = state.submit === 'busy';
  return (
    <div className="flex items-center gap-3">
      {/* The hover title alone is easy to miss: a locked target says so in plain sight. */}
      {blocker === 'locked' && (
        <span className="text-warning">{translate('convert.reason.locked')}</span>
      )}
      <Button
        variant="primary"
        size="lg"
        busy={busy}
        unavailable={blocker !== undefined}
        reason={blocker === undefined ? undefined : translate(`convert.reason.${blocker}`)}
        onClick={() => void actions.submit()}
      >
        {busy
          ? translate('convert.busy')
          : translate('convert.count', { count: readyCount(state) })}
      </Button>
    </div>
  );
};
