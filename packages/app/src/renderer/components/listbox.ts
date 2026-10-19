/** Where the active option moves for a key. Returns the same index when the key does nothing. */
export const moveActive = (key: string, active: number, count: number): number => {
  if (count === 0) return 0;
  if (key === 'ArrowDown') return Math.min(active + 1, count - 1);
  if (key === 'ArrowUp') return Math.max(active - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return active;
};

/** Typeahead: the next label starting with what was typed, searching from after the active one. */
export const typeahead = (typed: string, labels: string[], active: number): number => {
  const wanted = typed.toLowerCase();
  const order = [...labels.keys()].map((offset) => (active + 1 + offset) % labels.length);
  return order.find((index) => labels[index]?.toLowerCase().startsWith(wanted)) ?? active;
};
