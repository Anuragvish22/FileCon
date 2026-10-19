import { useStore } from '../store/context.tsx';

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
  return (
    <div role="status" className="banner" data-status={status}>
      <span>{translate(TEXT_FOR_STATUS[status])}</span>
      {status === 'unavailable' && (
        // Closing the last window quits the app (main's window-all-closed).
        <button type="button" onClick={() => window.close()}>
          {translate('banner.quit')}
        </button>
      )}
    </div>
  );
};
