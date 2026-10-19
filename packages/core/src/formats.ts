import type { Format, FormatInfo } from './types/index.ts';

// ARCHITECTURE section 6. First ext is the output ext.
export const FORMATS: readonly FormatInfo[] = [
  { id: 'jpg', category: 'image', exts: ['jpg', 'jpeg', 'jpe', 'jfif'] },
  { id: 'png', category: 'image', exts: ['png'] },
  { id: 'webp', category: 'image', exts: ['webp'] },
  { id: 'avif', category: 'image', exts: ['avif'] },
  { id: 'tiff', category: 'image', exts: ['tiff', 'tif'], multiPage: true },
  { id: 'gif', category: 'image', exts: ['gif'], multiPage: true },
  { id: 'svg', category: 'image', exts: ['svg'] },
  { id: 'pdf', category: 'pdf', exts: ['pdf'], multiPage: true },
  { id: 'doc', category: 'document', exts: ['doc'] },
  { id: 'docx', category: 'document', exts: ['docx'] },
  { id: 'odt', category: 'document', exts: ['odt'] },
  { id: 'rtf', category: 'document', exts: ['rtf'] },
  { id: 'xls', category: 'spreadsheet', exts: ['xls'] },
  { id: 'xlsx', category: 'spreadsheet', exts: ['xlsx'] },
  { id: 'ods', category: 'spreadsheet', exts: ['ods'] },
  { id: 'ppt', category: 'presentation', exts: ['ppt'] },
  { id: 'pptx', category: 'presentation', exts: ['pptx'] },
  { id: 'odp', category: 'presentation', exts: ['odp'] },
];

const ALIASES: Record<string, Format> = { jpeg: 'jpg', tif: 'tiff' };
const byId = new Map(FORMATS.map((format) => [format.id, format]));
const extMap = new Map(
  FORMATS.flatMap((format) => format.exts.map((ext) => [ext, format.id] as const)),
);

export const info = (id: Format): FormatInfo | undefined => byId.get(id);

export const canonical = (id: string): Format | null => {
  const lower = id.toLowerCase();
  const resolved = ALIASES[lower] ?? lower;
  return byId.has(resolved) ? resolved : null;
};

/** Accepts "JPG" or ".jpg" (what path.extname gives). */
export const byExt = (ext: string): Format | null =>
  extMap.get(ext.replace(/^\./, '').toLowerCase()) ?? null;
