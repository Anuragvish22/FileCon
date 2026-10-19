// Mirror of docs/CONTRACTS.md section 1. Change both together.

import type { ConvertOptions } from './options.ts';

export type Format = string; // canonical lowercase id: "jpg", "pdf", "docx"
export type PackId =
  | 'builtin'
  | 'office'
  | 'media'
  | 'docs'
  | 'imaging'
  | 'archive'
  | 'ebook'
  | '3d'
  | 'cad'
  | 'postscript'
  | 'ocr';
export type FormatCategory =
  | 'image'
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'audio'
  | 'video'
  | 'markup'
  | 'ebook'
  | '3d'
  | 'cad'
  | 'archive'
  | 'vector'
  | 'font'
  | 'data'
  | 'subtitle'
  | 'email';

export interface FormatInfo {
  id: Format; // display name: translate("format.<id>") (section 10)
  category: FormatCategory;
  exts: string[]; // without dot, first = preferred output ext
  multiPage?: boolean; // pdf, tiff, gif: may hold many pages/frames
}

export type OptionKey = keyof ConvertOptions;
export type LossyId = string; // kebab-case, e.g. "layout-approx". Text: translate("lossy.<id>")

export interface Edge {
  from: Format;
  to: Format;
  cost: number; // scale: ARCHITECTURE section 8
  lossy?: LossyId; // set when quality or data is lost (section 10)
  fanOut?: boolean; // produces one file per page/frame
  options?: OptionKey[]; // options this edge honours
}

export interface StepRequest {
  input: string; // absolute path (source or previous step output)
  from: Format;
  to: Format;
  outDir: string; // empty, job-private dir for this step
  baseName: string; // file stem to use, already filesystem-safe
  options: ConvertOptions;
}

// (in-process only)
export interface JobCtx {
  signal: AbortSignal;
  tmpDir: string; // job-private root, deleted by runner
  onProgress(fraction: number | null): void; // 0..1 for this step, null = indeterminate
  note(id: LossyId): void; // a loss found only at run time (e.g. "downscaled"). Collected into Job.notes
}

// (in-process only)
export interface Converter {
  id: string; // "sharp" | "pdflib" | "libreoffice" | …
  engineId: string; // EngineSpec id used for discovery ("builtin" engines: same as id)
  pack: PackId;
  edges: Edge[];
  timeoutMs?: number; // per step, default 120_000. The runner adds 4 s per MB of the step's input (max 30 min), so big files are not cut off while working
  maxConcurrent?: number; // default unlimited; libreoffice = 1
  available(): Promise<boolean>;
  /** Writes only inside req.outDir. Returns produced files (≥1). fanOut edges name files `page-<page>.<ext>` (page = the real 1-based page number) and return them in page order. */
  convert(req: StepRequest, ctx: JobCtx): Promise<string[]>;
}

// (in-process only)
export interface CombineRequest {
  inputs: string[]; // user order
  outDir: string; // empty, job-private dir
  options: ConvertOptions;
}

// (in-process only)
export interface ExtractRequest {
  input: string;
  outDir: string; // empty, job-private dir
  options: ConvertOptions;
}

// (in-process only)
export interface Combiner {
  id: string; // "merge-pdf"
  accepts: Format; // every input is routed to this first
  output: Format;
  /** inputs are in user order. Writes one file inside outDir and returns its path. */
  combine(req: CombineRequest, ctx: JobCtx): Promise<string>;
}

// (in-process only) 1 → many files of mixed formats. Lives outside the graph, like Combiner.
export interface Extractor {
  id: string; // "pdfimages"
  engineId: string; // "poppler"
  pack: PackId;
  accepts: Format; // "pdf". UI action text: translate("extract.<id>")
  folder: string; // output folder suffix: "images" → "report (images)/"
  options?: OptionKey[]; // e.g. ["pages"]
  timeoutMs?: number;
  available(): Promise<boolean>;
  /** Writes only inside outDir. Returns files in page order. An empty array means nothing found (the runner maps it to NOTHING_TO_EXTRACT). */
  extract(req: ExtractRequest, ctx: JobCtx): Promise<string[]>;
}

export interface Step {
  converterId: string;
  from: Format;
  to: Format;
}

export interface Route {
  steps: Step[]; // length 1..3
  cost: number; // sum of edge costs
  hops: number; // = steps.length
  lossy: LossyId[]; // union of edge notes, in step order, deduped
  fanOut: boolean; // true if any step fans out (max one per route)
}
