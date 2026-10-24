import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx.ts';
import { useUnavailable, type UnavailableProps } from './unavailable.tsx';

const VARIANTS = {
  primary:
    'bg-accent text-accent-fg hover:bg-accent-hover aria-disabled:bg-surface aria-disabled:text-fg-disabled aria-disabled:hover:bg-surface',
  secondary:
    'border border-border-strong bg-surface text-fg hover:bg-accent-subtle aria-disabled:text-fg-disabled aria-disabled:hover:bg-surface',
  ghost:
    'text-fg hover:bg-accent-subtle aria-disabled:text-fg-disabled aria-disabled:hover:bg-transparent',
  danger:
    'border border-danger-border bg-danger-subtle text-danger hover:underline aria-disabled:text-fg-disabled',
} as const;

const SIZES = {
  md: 'h-8 min-w-8 px-3 text-sm',
  sm: 'h-7 min-w-7 px-2 text-sm',
  icon: 'size-8 justify-center',
} as const;

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'>, UnavailableProps {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}

export const Button = ({
  variant = 'secondary',
  size = 'md',
  unavailable,
  reason,
  busy,
  className,
  onClick,
  children,
  ...rest
}: ButtonProps) => {
  const state = useUnavailable({ unavailable, reason, busy });
  return (
    <button
      type="button"
      {...rest}
      {...state.attributes}
      onClick={state.guard(onClick)}
      className={cx(
        'inline-flex items-center gap-2 rounded-control font-medium transition-colors aria-disabled:cursor-not-allowed aria-disabled:border-dashed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
      {state.reasonText()}
    </button>
  );
};
