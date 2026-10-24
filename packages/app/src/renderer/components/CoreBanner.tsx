import { useStore } from '../store/context.tsx';
import { Button } from './ui/Button.tsx';

const TEXT_FOR_STATUS = {
  starting: 'banner.starting',
  restarting: 'banner.restarting',
  unavailable: 'banner.unavailable',
} as const;

/** UI-DESIGN section 5: hidden once core is `ready`. */
export const CoreBanner = () => {
  const { state, translate } = useStore();
  const { status } = state.core;
  if (status === 'ready') return null;
  const failed = status === 'unavailable';
  return (
    <div
      role="status"
      data-status={status}
      className={`flex items-center justify-between gap-3 border-b px-6 py-2 text-sm ${failed ? 'border-danger-border bg-danger-subtle text-danger' : 'border-warning-border bg-warning-subtle text-warning'}`}
    >
      <span>{translate(TEXT_FOR_STATUS[status])}</span>
      {failed && (
        // Closing the last window quits the app (main's window-all-closed).
        <Button variant="danger" size="sm" onClick={() => window.close()}>
          {translate('banner.quit')}
        </Button>
      )}
    </div>
  );
};
