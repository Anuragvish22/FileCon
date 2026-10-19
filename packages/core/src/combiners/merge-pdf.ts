import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { CoreFailure } from '../errors.ts';
import type { Combiner } from '../types/index.ts';

const MERGED_NAME = 'merged.pdf';
// pdf-lib's EncryptedPDFError loses its prototype in the published build, so instanceof can't see it: match the message.
const ENCRYPTED_MESSAGE = /is encrypted/i;

// shortcut: each input is held in memory while its pages are copied; fine for normal documents, revisit if huge scans are reported.
export const mergePdf: Combiner = {
  id: 'merge-pdf',
  accepts: 'pdf',
  output: 'pdf',

  async combine({ inputs, outDir }, ctx) {
    const merged = await PDFDocument.create();
    for (const [index, input] of inputs.entries()) {
      if (ctx.signal.aborted) throw new CoreFailure('CANCELLED');
      try {
        const source = await PDFDocument.load(await readFile(input));
        for (const page of await merged.copyPages(source, source.getPageIndices()))
          merged.addPage(page);
      } catch (caught) {
        if (caught instanceof Error && ENCRYPTED_MESSAGE.test(caught.message))
          throw new CoreFailure('INPUT_ENCRYPTED', { name: basename(input) });
        const message = caught instanceof Error ? caught.message : String(caught);
        throw new CoreFailure(
          'ENGINE_FAILED',
          { engine: 'pdflib', name: basename(input) },
          message,
        );
      }
      ctx.onProgress((index + 1) / inputs.length);
    }
    const output = join(outDir, MERGED_NAME);
    await writeFile(output, await merged.save());
    return output;
  },
};
