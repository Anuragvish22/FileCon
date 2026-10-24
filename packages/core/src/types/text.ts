import { z } from 'zod';

export const LOCALES = ['en'] as const; // add one entry per shipped locale file
export const LocaleSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof LocaleSchema>;

export const ACCENTS = ['blue', 'green', 'purple', 'orange'] as const;
export const AccentSchema = z.enum(ACCENTS);
export type Accent = z.infer<typeof AccentSchema>;
