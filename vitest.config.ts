import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', { test: { name: 'tooling', include: ['test/tooling/**/*.test.ts'] } }],
    coverage: {
      provider: 'v8',
      // BUILD-PLAN M0 exit: the logic modules must be at least 90% covered by lines.
      include: [
        'packages/core/src/graph/**',
        'packages/core/src/detect.ts',
        'packages/core/src/jobs/output.ts',
      ],
      thresholds: { lines: 90 },
    },
  },
});
