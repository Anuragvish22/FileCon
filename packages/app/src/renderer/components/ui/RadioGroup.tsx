import * as RadixRadio from '@radix-ui/react-radio-group';
import { cx } from './cx.ts';

export interface RadioOption {
  value: string;
  label: string;
}

export interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly RadioOption[];
  /** Names the group for screen readers. */
  label: string;
  className?: string;
}

export const RadioGroup = ({
  value,
  onValueChange,
  options,
  label,
  className,
}: RadioGroupProps) => (
  <RadixRadio.Root
    value={value}
    onValueChange={onValueChange}
    aria-label={label}
    className={cx('flex flex-col gap-2', className)}
  >
    {options.map((option) => (
      <label key={option.value} className="inline-flex items-center gap-2 text-sm">
        <RadixRadio.Item
          value={option.value}
          className="flex size-5 items-center justify-center rounded-full border border-border-strong bg-surface data-[state=checked]:border-accent"
        >
          <RadixRadio.Indicator className="size-2.5 rounded-full bg-accent" />
        </RadixRadio.Item>
        {option.label}
      </label>
    ))}
  </RadixRadio.Root>
);
