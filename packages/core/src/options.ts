import { z } from 'zod';
import { CoreFailure } from './errors.ts';
import { ConvertOptionsSchema } from './types/index.ts';

// A field's failure message is its `what` id (types/options.ts); any other message is a malformed shape.
const WHAT_ID = /^[a-z]+(-[a-z]+)*-(range|value)$/;

/** INVALID_REQUEST with `what: "<option>-range"` or `"<option>-value"` (text: `invalid.<what>`) when a field named one. */
export const invalidRequest = (error: z.ZodError): CoreFailure => {
  const what = error.issues.map((issue) => issue.message).find((message) => WHAT_ID.test(message));
  return new CoreFailure('INVALID_REQUEST', what === undefined ? {} : { what });
};

/** Throws `invalidRequest` when the options are out of range or of the wrong type. */
export const validateOptions = (options: unknown): void => {
  const result = ConvertOptionsSchema.safeParse(options);
  if (!result.success) throw invalidRequest(result.error);
};
