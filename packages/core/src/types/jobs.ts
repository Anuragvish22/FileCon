// Mirror of docs/CONTRACTS.md section 4. Change both together.

import type { Format, LossyId } from './domain.ts';
import type { CoreError } from './errors.ts';
import type { ConvertOptions } from './options.ts';

export type JobRequest =
  | { kind: 'convert'; input: string; target: Format; options: ConvertOptions; outDir?: string }
  | {
      kind: 'merge';
      inputs: string[];
      combinerId: string;
      options: ConvertOptions;
      outDir?: string;
    }
  | {
      kind: 'extract';
      input: string;
      extractorId: string;
      options: ConvertOptions;
      outDir?: string;
    };
// outDir omitted = Settings.output (source folder or custom dir)

export interface SubmitResult {
  batchId: string;
  jobIds: string[];
} // same order as requests

export type JobState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  batchId: string;
  kind: 'convert' | 'merge' | 'extract';
  inputs: string[]; // 1 for convert and extract, N for merge (user order)
  target: Format;
  state: JobState;
  progress: { unit: number; total: number; fraction: number | null }; // overall 0..1, null = indeterminate
  outputs: string[]; // final paths; a multi-output job has 1 folder + its files
  notes: LossyId[]; // run-time losses reported by steps via JobCtx.note, deduped, in order
  error?: CoreError;
  createdAt: number; // epoch ms
  startedAt?: number;
  endedAt?: number;
}
