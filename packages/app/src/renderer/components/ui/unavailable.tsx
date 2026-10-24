import { useId, type MouseEvent, type ReactNode } from 'react';

// UI-DESIGN section 8.9, rule 5: an unavailable control stays focusable and says why. The native
// `disabled` attribute would take it out of the tab order and hide it from screen readers.
export interface UnavailableProps {
  unavailable?: boolean;
  /** Why it is unavailable. Read by screen readers, and shown as the hover title. */
  reason?: string;
  busy?: boolean;
}

export const useUnavailable = ({ unavailable = false, reason, busy = false }: UnavailableProps) => {
  const reasonId = useId();
  const inert = unavailable || busy;
  return {
    inert,
    attributes: {
      'aria-disabled': inert || undefined,
      'aria-busy': busy || undefined,
      'aria-describedby': unavailable && reason !== undefined ? reasonId : undefined,
      title: unavailable ? reason : undefined,
    },
    /** Wraps a click handler so it does nothing while the control is inert. */
    guard:
      <Event extends MouseEvent>(handler?: (event: Event) => void) =>
      (event: Event): void => {
        if (inert) event.preventDefault();
        else handler?.(event);
      },
    reasonText: (): ReactNode =>
      unavailable && reason !== undefined ? (
        <span id={reasonId} className="sr-only">
          {reason}
        </span>
      ) : null,
  };
};
