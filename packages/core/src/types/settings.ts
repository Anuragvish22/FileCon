import { z } from 'zod';
import { AccentSchema, LocaleSchema } from './text.ts';

export const SETTINGS_VERSION = 1;
export const MAX_CONCURRENCY = 32;

// Unknown keys are dropped. Main also requires absolute paths, which needs `node:path`, so it checks that itself.
export const SettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  output: z
    .object({ mode: z.enum(['source', 'custom']), dir: z.string().optional() })
    .refine((output) => output.mode !== 'custom' || output.dir !== undefined) // dir required when mode = custom
    .transform((output) => (output.mode === 'custom' ? output : { mode: output.mode })),
  concurrency: z.union([
    z.literal('auto'), // max(1, cpus - 1)
    z.number().int().min(1).max(MAX_CONCURRENCY),
  ]),
  engines: z.object({
    paths: z.record(z.string(), z.string()), // engineId → absolute binary path (user override)
    priority: z.array(z.string()), // converter ids, earlier wins equal-cost ties
  }),
  ui: z.object({
    theme: z.enum(['system', 'light', 'dark']),
    accent: AccentSchema,
    language: z.union([z.literal('system'), LocaleSchema]), // system = navigator.language if it's a known Locale, else "en"
  }),
});

export type Settings = z.infer<typeof SettingsSchema>;
