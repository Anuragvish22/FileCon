// Mirror of docs/CONTRACTS.md section 3. Change both together.

import type { Format, LossyId, OptionKey, PackId, Route } from './domain.ts';
import type { CoreError } from './errors.ts';

export interface DetectResult {
  path: string;
  size: number; // bytes
  format: Format | null; // what core will treat it as; null = unsupported
  byContent: Format | null;
  byExt: Format | null;
  mismatch: boolean; // content and extension disagree (aliases ignored)
  error?: CoreError; // INPUT_NOT_FOUND | INPUT_UNREADABLE | EMPTY_FILE | UNSUPPORTED_FORMAT
}

export interface TargetOption {
  format: Format;
  status: 'ready' | 'needs-pack';
  pack?: PackId; // set when status = needs-pack (first missing pack on cheapest full-graph route)
  route?: Route; // set when ready and a single source format is given
  lossy: LossyId[]; // union across all inputs' routes
  fanOut: boolean; // any input's route fans out
  options: OptionKey[]; // union of options honoured on the routes
}

export interface TargetsResult {
  convert: TargetOption[]; // formats reachable from every input
  merge: {
    combinerId: string;
    output: Format;
    status: 'ready' | 'needs-pack';
    pack?: PackId;
    fanOut: boolean; // some input's route to `accepts` fans out, so 1 file can merge (renderer applies the count rule)
  }[];
  extract: {
    extractorId: string;
    status: 'ready' | 'needs-pack';
    pack?: PackId;
    options: OptionKey[];
  }[];
  // extract: extractors whose `accepts` equals every input's format (no routing)
}
