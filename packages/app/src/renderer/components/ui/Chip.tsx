import { Check, Lock, TriangleAlert } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx.ts';
import { useUnavailable } from './unavailable.tsx';

// The three states of a format chip (UI-DESIGN section 3): ready to pick, needs a pack (a lock that
// still opens Engines), or not possible for this file (dimmed, dashed, with its reason).
export type ChipState = 'available' | 'locked' | 'unavailable';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  state?: ChipState;
  selected?: boolean;
  /** A plain list entry instead of a button, for the format popover. */
  flat?: boolean;
  /** The route loses quality: shows the warning icon. */
  lossy?: boolean;
  /** For `unavailable`: why this chip can't be picked. */
  reason?: string;
}

const ICON_SIZE = 16;

export const Chip = ({
  state = 'available',
  selected = false,
  lossy = false,
  flat = false,
  reason,
  className,
  onClick,
  children,
  ...rest
}: ChipProps) => {
  const status = useUnavailable({ unavailable: state === 'unavailable', reason });
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...rest}
      {...status.attributes}
      onClick={status.guard(onClick)}
      className={cx(
        'inline-flex items-center gap-1 rounded-control text-sm transition-colors',
        flat
          ? 'h-9 w-full justify-start px-3 text-start hover:bg-accent-subtle data-[active=true]:bg-accent-subtle'
          : 'h-8 border px-3 font-semibold',
        !flat &&
          (selected
            ? 'border-accent bg-accent text-accent-fg hover:bg-accent-hover'
            : 'border-border-strong bg-surface text-fg hover:bg-accent-subtle'),
        flat && selected && 'font-semibold text-accent',
        'aria-disabled:cursor-not-allowed aria-disabled:text-fg-disabled aria-disabled:hover:bg-transparent',
        !flat && 'aria-disabled:border-dashed aria-disabled:bg-transparent',
        className,
      )}
    >
      {selected && <Check size={ICON_SIZE} aria-hidden="true" />}
      {state === 'locked' && <Lock size={ICON_SIZE} aria-hidden="true" />}
      {lossy && <TriangleAlert size={ICON_SIZE} aria-hidden="true" />}
      {children}
      {status.reasonText()}
    </button>
  );
};
