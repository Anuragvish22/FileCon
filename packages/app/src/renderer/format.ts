import { info } from '@filecon/core/formats';
import type { FormatCategory, TargetOption } from '@filecon/core/types';

export const categoryOf = (format: string): FormatCategory | undefined => info(format)?.category;

/** Targets grouped by category, in the order the categories first appear (UI-DESIGN section 3). */
export const groupTargets = (
  targets: TargetOption[],
): { category: FormatCategory | undefined; options: TargetOption[] }[] => {
  const groups = new Map<FormatCategory | undefined, TargetOption[]>();
  for (const option of targets) {
    const category = categoryOf(option.format);
    groups.set(category, [...(groups.get(category) ?? []), option]);
  }
  return [...groups].map(([category, options]) => ({ category, options }));
};

const OFFICE_CATEGORIES: readonly (FormatCategory | undefined)[] = [
  'document',
  'spreadsheet',
  'presentation',
];

/** P9: office files rendered to pdf can show boxes for scripts the machine has no font for. */
export const needsFontNote = (inputs: string[], target: string | null): boolean =>
  target === 'pdf' &&
  inputs.some((format) => format !== 'pdf' && OFFICE_CATEGORIES.includes(categoryOf(format)));
