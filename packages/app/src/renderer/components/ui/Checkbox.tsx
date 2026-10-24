import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx.ts';

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** The visible label, which is also the accessible name. */
  children: ReactNode;
  className?: string;
}

const ICON_SIZE = 16;

export const Checkbox = ({ checked, onCheckedChange, children, className }: CheckboxProps) => (
  <label className={cx('inline-flex items-center gap-2 text-sm', className)}>
    <RadixCheckbox.Root
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(next === true)}
      className="flex size-5 items-center justify-center rounded-control border border-border-strong bg-surface data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg"
    >
      <RadixCheckbox.Indicator>
        <Check size={ICON_SIZE} aria-hidden="true" />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
    {children}
  </label>
);
