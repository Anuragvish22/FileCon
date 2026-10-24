import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export const TooltipProvider = RadixTooltip.Provider;

export interface TooltipProps {
  /** The tooltip text. It is also described to screen readers through the trigger. */
  content: string;
  /** The element that triggers it, which must take focus. */
  children: ReactNode;
}

export const Tooltip = ({ content, children }: TooltipProps) => (
  <RadixTooltip.Root>
    <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={4}
        className="z-50 max-w-xs rounded-control border border-border bg-surface-raised px-2 py-1 text-xs text-fg shadow-popover"
      >
        {content}
      </RadixTooltip.Content>
    </RadixTooltip.Portal>
  </RadixTooltip.Root>
);
