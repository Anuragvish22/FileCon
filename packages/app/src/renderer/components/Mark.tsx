/** The product mark: one file turning into another, drawn from two offset rounded squares. */
export const Mark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <rect
      x="2"
      y="2"
      width="14"
      height="14"
      rx="4"
      className="fill-accent-subtle stroke-accent"
      strokeWidth="1.5"
    />
    <rect x="8" y="8" width="14" height="14" rx="4" className="fill-accent" />
  </svg>
);
