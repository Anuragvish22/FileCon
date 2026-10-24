import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx.ts';

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;

export interface DialogContentProps {
  title: string;
  description?: string;
  /** Names the icon-only close button. */
  closeLabel: string;
  className?: string;
  children: ReactNode;
}

const ICON_SIZE = 16;

export const DialogContent = ({
  title,
  description,
  closeLabel,
  className,
  children,
}: DialogContentProps) => (
  <RadixDialog.Portal>
    <RadixDialog.Overlay className="fixed inset-0 z-40 bg-overlay" />
    <RadixDialog.Content
      {...(description === undefined ? { 'aria-describedby': undefined } : {})}
      className={cx(
        'fixed start-1/2 top-1/2 z-50 w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-border bg-surface-raised p-4 text-fg shadow-popover rtl:translate-x-1/2',
        className,
      )}
    >
      <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
      {description !== undefined && (
        <RadixDialog.Description className="mt-1 text-sm text-muted">
          {description}
        </RadixDialog.Description>
      )}
      <div className="mt-3">{children}</div>
      <RadixDialog.Close
        aria-label={closeLabel}
        className="absolute end-2 top-2 inline-flex size-8 items-center justify-center rounded-control hover:bg-accent-subtle"
      >
        <X size={ICON_SIZE} aria-hidden="true" />
      </RadixDialog.Close>
    </RadixDialog.Content>
  </RadixDialog.Portal>
);
