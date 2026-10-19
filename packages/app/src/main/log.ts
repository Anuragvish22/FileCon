import { appendFile, mkdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  log(level: LogLevel, message: string): void;
  /** Resolves when every line written so far is on disk. */
  flush(): Promise<void>;
}

interface LoggerInput {
  dir: string;
  now?: () => Date;
}

const FILE = 'filecon.log';
const ROTATED_FILE = 'filecon.log.1';
const MAX_BYTES = 1_000_000;

/**
 * Appends `<iso time> <level> <message>` lines to `<dir>/filecon.log`. Core sends codes and params, never
 * translated text, so nothing here is user-facing prose. Write errors are swallowed: logging must never
 * take the app down.
 * Rotates once the file passes the size limit, at startup and mid-session; only the previous file is kept, as `.1`.
 */
export const createLogger = async ({
  dir,
  now = () => new Date(),
}: LoggerInput): Promise<Logger> => {
  const file = join(dir, FILE);
  await mkdir(dir, { recursive: true });
  let size = (await stat(file).catch(() => undefined))?.size ?? 0;

  // One chain, so lines land in call order and rotation never overlaps a write.
  let pending: Promise<void> = Promise.resolve();
  const write = async (line: string): Promise<void> => {
    if (size > MAX_BYTES) {
      await rename(file, join(dir, ROTATED_FILE));
      size = 0;
    }
    await appendFile(file, line);
    size += Buffer.byteLength(line);
  };
  // Startup rotation goes through the same path, so a first line is not needed to trigger it.
  pending = size > MAX_BYTES ? write('').catch(() => undefined) : pending;
  return {
    log(level, message) {
      const line = `${now().toISOString()} ${level} ${message.replaceAll('\n', '\\n')}\n`;
      pending = pending.then(() => write(line)).catch(() => undefined);
    },
    flush: () => pending,
  };
};
