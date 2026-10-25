import { stderr, stdout } from 'node:process';
import { convertImage } from './job.ts';
import type { StepRequest } from '../../types/index.ts';

// Entry of the child process that converter.ts starts: the request comes as JSON in argv, the notes go out as JSON on stdout.
const request = JSON.parse(process.argv[2] ?? '') as StepRequest;
convertImage(request).then(
  (notes) => stdout.write(JSON.stringify(notes), () => process.exit(0)),
  (caught: unknown) =>
    stderr.write(caught instanceof Error ? caught.message : String(caught), () => process.exit(1)),
);
