import { z } from 'zod';
import type { Format, LossyId } from './domain.ts';
import type { CoreError } from './errors.ts';
import { ConvertOptionsSchema } from './options.ts';

const OutDir = z.string().min(1).optional(); // omitted = Settings.output (source folder or custom dir)
const Path = z.string().min(1);

export const JobRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('convert'),
    input: Path,
    target: z.string().min(1), // a Format. Core canonicalizes aliases, see rpc/protocol.ts
    options: ConvertOptionsSchema,
    outDir: OutDir,
  }),
  z.object({
    kind: z.literal('merge'),
    inputs: z.array(Path),
    combinerId: Path,
    options: ConvertOptionsSchema,
    outDir: OutDir,
  }),
  z.object({
    kind: z.literal('extract'),
    input: Path,
    extractorId: Path,
    options: ConvertOptionsSchema,
    outDir: OutDir,
  }),
]);
export type JobRequest = z.infer<typeof JobRequestSchema>;

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
