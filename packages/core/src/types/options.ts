import { z } from 'zod';

// Out-of-range values fail, they are never clamped. A failing field's message is its `what` id
// (text: `invalid.<what>`), so the RPC layer can pass it on without a lookup table.
const ranged = (what: string, min: number, max: number) =>
  z
    .number({ error: what })
    .int({ error: what })
    .min(min, { error: what })
    .max(max, { error: what });

const MAX_QUALITY = 100;
const MIN_DPI = 72;
const MAX_DPI = 600;
const MAX_PIXELS = 65535;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const ConvertOptionsSchema = z.object({
  quality: ranged('quality-range', 1, MAX_QUALITY).optional(), // lossy image encoders. Default 90
  dpi: ranged('dpi-range', MIN_DPI, MAX_DPI).optional(), // rasterizing (pdf→image). Default 150
  pageSize: z.enum(['auto', 'a4', 'letter'], { error: 'page-size-value' }).optional(), // image→pdf. "auto" = page fits image. Default "auto"
  pages: z.string().optional(), // pdf input only: "1-3,7,10-" (1-based). Empty/absent = all pages
  width: ranged('width-range', 1, MAX_PIXELS).optional(), // px, images. Fit inside width × height, aspect kept, never enlarged
  height: ranged('height-range', 1, MAX_PIXELS).optional(), // px. Either one alone works. shortcut: no upscaling, add when asked
  grayscale: z.boolean().optional(), // images. Default false
  keepMetadata: z.boolean().optional(), // images. Default false: EXIF, GPS and XMP are stripped. The ICC profile is always kept
  tiffCompression: z
    .enum(['lzw', 'deflate', 'jpeg', 'none'], { error: 'tiff-compression-value' })
    .optional(), // tiff output only. Default "lzw"
  background: z.string().regex(HEX_COLOR, { error: 'background-value' }).optional(), // jpg output only: "#rrggbb" that transparent pixels are flattened onto. Default "#ffffff"
});

export type ConvertOptions = z.infer<typeof ConvertOptionsSchema>;
