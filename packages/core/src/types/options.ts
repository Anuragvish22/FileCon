// Mirror of docs/CONTRACTS.md section 2. Change both together.

export interface ConvertOptions {
  quality?: number; // 1..100, lossy image encoders. Default 90
  dpi?: number; // 72..600, rasterizing (pdf→image). Default 150
  pageSize?: 'auto' | 'a4' | 'letter'; // image→pdf. "auto" = page fits image. Default "auto"
  pages?: string; // pdf input only: "1-3,7,10-" (1-based). Empty/absent = all pages
}
