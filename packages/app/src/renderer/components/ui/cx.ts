export type ClassPart = string | false | null | undefined;

/** Joins class names, skipping the ones that are off. */
export const cx = (...parts: ClassPart[]): string => parts.filter(Boolean).join(' ');
