import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

export interface PageSize {
  width: number;
  height: number;
}

/** A pdf whose pages have exactly these sizes, so page order can be read back from the sizes. */
export const makePdf = async (sizes: PageSize[]): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  for (const { width, height } of sizes) doc.addPage([width, height]);
  return doc.save();
};

export const pageSizes = async (path: string): Promise<PageSize[]> => {
  const doc = await PDFDocument.load(await readFile(path));
  return doc.getPages().map((page) => page.getSize());
};
