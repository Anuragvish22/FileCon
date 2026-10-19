import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../../src/main/log.ts';

let dir = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'filecon-log-'));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const FIXED = new Date('2026-01-02T03:04:05.000Z');

describe('createLogger', () => {
  it('appends lines in call order', async () => {
    const logger = await createLogger({ dir, now: () => FIXED });
    logger.log('info', 'first');
    logger.log('warn', 'second\nline');
    await logger.flush();
    expect(await readFile(join(dir, 'filecon.log'), 'utf8')).toBe(
      '2026-01-02T03:04:05.000Z info first\n2026-01-02T03:04:05.000Z warn second\\nline\n',
    );
  });

  it('keeps the previous file as .1 when it is over the size limit', async () => {
    await writeFile(join(dir, 'filecon.log'), 'x'.repeat(1_000_001));
    const logger = await createLogger({ dir });
    logger.log('info', 'fresh');
    await logger.flush();
    expect((await readFile(join(dir, 'filecon.log.1'), 'utf8')).length).toBe(1_000_001);
    expect(await readFile(join(dir, 'filecon.log'), 'utf8')).toContain('info fresh');
  });

  it('rotates mid-session when the file grows past the limit', async () => {
    const logger = await createLogger({ dir });
    logger.log('info', 'x'.repeat(1_000_001));
    logger.log('info', 'after');
    await logger.flush();
    expect(await readFile(join(dir, 'filecon.log.1'), 'utf8')).toContain('xxxx');
    expect(await readFile(join(dir, 'filecon.log'), 'utf8')).toContain('info after');
  });

  it('never throws when the file cannot be written', async () => {
    const logger = await createLogger({ dir });
    await rm(dir, { recursive: true, force: true });
    logger.log('error', 'lost');
    await expect(logger.flush()).resolves.toBeUndefined();
  });
});
