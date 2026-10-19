// The edge cost scale (ARCHITECTURE section 8). Edges use these names, never bare numbers.
export const COST = {
  container: 1, // lossless container or wrapper change: jpg → pdf, mp4 → mkv remux
  losslessReencode: 2, // png → tiff, png → webp (lossless)
  lossyReencode: 3, // good-quality lossy re-encode: png → jpg
  render: 5, // render or rasterize: docx → pdf, pdf → png
  approximate: 8, // approximate reconstruction: pdf → docx
  majorLoss: 10, // major data loss: step → stl, video → gif
} as const;
