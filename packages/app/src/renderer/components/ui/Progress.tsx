import * as RadixProgress from '@radix-ui/react-progress';
import { cx } from './cx.ts';

export interface ProgressProps {
  /** 0 to 1, or null when the engine can't tell (an indeterminate bar). */
  fraction: number | null;
  /** Names the bar for screen readers. */
  label: string;
  className?: string;
}

const PERCENT = 100;

export const Progress = ({ fraction, label, className }: ProgressProps) => (
  <RadixProgress.Root
    value={fraction === null ? null : Math.round(fraction * PERCENT)}
    aria-label={label}
    className={cx('relative h-2 w-full overflow-hidden rounded-full bg-surface', className)}
  >
    <RadixProgress.Indicator
      className={cx(
        'h-full rounded-full bg-accent transition-[width] duration-100',
        fraction === null && 'w-1/3 animate-pulse',
      )}
      style={fraction === null ? undefined : { width: `${Math.round(fraction * PERCENT)}%` }}
    />
  </RadixProgress.Root>
);
