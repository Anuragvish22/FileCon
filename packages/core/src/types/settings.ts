// Mirror of docs/CONTRACTS.md section 8. Change both together.

import type { Accent, Locale } from './text.ts';

export interface Settings {
  version: 1;
  output: { mode: 'source' | 'custom'; dir?: string }; // dir required when mode = custom
  concurrency: 'auto' | number; // number: 1..32. auto = max(1, cpus - 1)
  engines: {
    paths: Record<string, string>; // engineId → absolute binary path (user override)
    priority: string[]; // converter ids, earlier wins equal-cost ties
  };
  ui: {
    theme: 'system' | 'light' | 'dark';
    accent: Accent; // section 10
    language: 'system' | Locale; // system = navigator.language if it's a known Locale, else "en"
  };
}
