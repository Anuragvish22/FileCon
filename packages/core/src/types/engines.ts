// Mirror of docs/CONTRACTS.md section 9. Change both together.

import type { PackId } from './domain.ts';

export interface EngineInfo {
  id: string; // "libreoffice", "ffmpeg", "sharp"
  pack: PackId;
  found: boolean;
  path?: string; // absent for bundled libraries
  version?: string;
  source?: 'bundled' | 'override' | 'installed' | 'path' | 'known-dir';
  installUrl: string; // human install guide
  install?: InstallMethod; // for the current platform, from EngineSpec.install
  error?: string; // e.g. override path invalid, version probe failed
}

// (in-process only) declared in core/src/engines/specs.ts
export interface EngineSpec {
  id: string;
  pack: PackId;
  bundled?: boolean; // sharp, pdf-lib: no discovery
  bins?: { win32: string[]; darwin: string[]; linux: string[] }; // names to look up on PATH
  knownPaths?: { win32: string[]; darwin: string[]; linux: string[] }; // absolute candidates (globs allowed)
  versionArgs?: string[]; // ["--version"]
  versionPattern?: string; // regex source, first capture = version
  installUrl: string;
  install?: { win32?: InstallMethod; darwin?: InstallMethod; linux?: InstallMethod };
  requiredBins?: string[]; // all must be found in the same dir (poppler: pdftoppm, pdfimages, pdfinfo)
}

export type InstallMethod =
  | {
      kind: 'download';
      version: string;
      url: string;
      sha256: string;
      sizeBytes: number;
      archive: 'zip';
      binDir: string;
    } // binDir: path inside the archive holding the binaries
  | { kind: 'command'; commands: { label: string; cmd: string }[] }; // shown with Copy buttons, never executed
