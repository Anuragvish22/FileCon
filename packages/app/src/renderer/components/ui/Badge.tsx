import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx.ts';

// Status is icon plus text, never color alone (UI-DESIGN section 8.8).
const STATUSES = {
  neutral: { icon: undefined, classes: 'border-border-strong bg-surface text-fg' },
  success: { icon: CircleCheck, classes: 'border-success-border bg-success-subtle text-success' },
  warning: { icon: TriangleAlert, classes: 'border-warning-border bg-warning-subtle text-warning' },
  info: { icon: Info, classes: 'border-info-border bg-info-subtle text-info' },
  danger: { icon: CircleX, classes: 'border-danger-border bg-danger-subtle text-danger' },
} as const satisfies Record<string, { icon: LucideIcon | undefined; classes: string }>;

export interface BadgeProps {
  status?: keyof typeof STATUSES;
  /** Replaces the icon of the status. */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

const ICON_SIZE = 16;

export const Badge = ({ status = 'neutral', icon, className, children }: BadgeProps) => {
  const { icon: StatusIcon, classes } = STATUSES[status];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-control border px-2 py-0.5 text-xs font-medium',
        classes,
        className,
      )}
    >
      {icon ??
        (StatusIcon === undefined ? null : <StatusIcon size={ICON_SIZE} aria-hidden="true" />)}
      {children}
    </span>
  );
};
