import { useStore } from '../store/context.tsx';
import { ConvertButton } from './ConvertButton.tsx';
import { OutputChooser } from './OutputChooser.tsx';

/** Save to and Convert, always in view at the bottom (UI-DESIGN section 3). Hidden while empty. */
export const ActionBar = () => {
  const { state } = useStore();
  if (state.files.length + state.detecting.length === 0) return null;
  return (
    <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border bg-bg py-3">
      <OutputChooser />
      <ConvertButton />
    </div>
  );
};
