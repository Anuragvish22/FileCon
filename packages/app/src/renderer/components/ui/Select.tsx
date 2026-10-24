import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cx } from './cx.ts';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  /** Names the select for screen readers. */
  label: string;
  placeholder?: string;
  className?: string;
}

const ICON_SIZE = 16;

export const Select = ({
  value,
  onValueChange,
  options,
  label,
  placeholder,
  className,
}: SelectProps) => (
  <RadixSelect.Root value={value} onValueChange={onValueChange}>
    <RadixSelect.Trigger
      aria-label={label}
      className={cx(
        'inline-flex h-8 items-center justify-between gap-2 rounded-control border border-border-strong bg-surface px-3 text-sm text-fg hover:bg-accent-subtle',
        className,
      )}
    >
      <RadixSelect.Value placeholder={placeholder} />
      <RadixSelect.Icon>
        <ChevronDown size={ICON_SIZE} aria-hidden="true" />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
    <RadixSelect.Portal>
      <RadixSelect.Content
        position="popper"
        sideOffset={4}
        className="z-50 rounded-card border border-border bg-surface-raised p-1 text-fg shadow-popover"
      >
        <RadixSelect.Viewport>
          {options.map((option) => (
            <RadixSelect.Item
              key={option.value}
              value={option.value}
              className="flex h-8 cursor-pointer items-center gap-2 rounded-control px-2 text-sm data-[highlighted]:bg-accent-subtle"
            >
              <RadixSelect.ItemIndicator>
                <Check size={ICON_SIZE} aria-hidden="true" />
              </RadixSelect.ItemIndicator>
              <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
            </RadixSelect.Item>
          ))}
        </RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  </RadixSelect.Root>
);
