import { describe, expect, it } from 'vitest';
import { scaledTimeout } from '../../src/jobs/timeout.ts';

const BASE = 180_000;
const MB = 1_000_000;

describe('scaledTimeout', () => {
  it('keeps the base for a small input, so tests with short limits stay short', () => {
    expect(scaledTimeout(BASE, 0)).toBe(BASE);
    expect(scaledTimeout(BASE, MB - 1)).toBe(BASE);
  });

  it('grows with the input size', () => {
    expect(scaledTimeout(BASE, 10 * MB)).toBeGreaterThan(scaledTimeout(BASE, 5 * MB));
    expect(scaledTimeout(BASE, 10 * MB)).toBe(BASE + 10 * 4000);
  });

  it('stops at 30 minutes however big the input is', () => {
    expect(scaledTimeout(BASE, 100_000 * MB)).toBe(30 * 60_000);
  });

  it('never lowers a base that is already above the ceiling', () => {
    expect(scaledTimeout(40 * 60_000, 100_000 * MB)).toBe(40 * 60_000);
  });
});
