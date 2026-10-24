import * as RadixPopover from '@radix-ui/react-popover';
import type { ComponentProps } from 'react';
import { cx } from './cx.ts';

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;

export const PopoverContent = ({
  className,
  ...rest
}: ComponentProps<typeof RadixPopover.Content>) => (
  <RadixPopover.Portal>
    <RadixPopover.Content
      sideOffset={4}
      {...rest}
      className={cx(
        'z-50 rounded-card border border-border bg-surface-raised p-3 text-fg shadow-popover',
        className,
      )}
    />
  </RadixPopover.Portal>
);
