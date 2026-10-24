import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// P43: only `pnpm dev` may relax the CSP (Vite injects CSS for hot reload). The built page uses the
// compiled Tailwind file, so its policy must stay strict.
const app = join(import.meta.dirname, '..', '..', 'packages', 'app');
const html = readFileSync(join(app, 'src', 'renderer', 'index.html'), 'utf8');
const config = readFileSync(join(app, 'electron.vite.config.ts'), 'utf8');

describe('renderer CSP', () => {
  it('the page itself allows only its own files', () => {
    const policy = /Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(policy).toBe("default-src 'self'");
    expect(policy).not.toContain('unsafe');
  });

  it('only the dev server relaxes it', () => {
    const relaxing = config.indexOf('unsafe-inline');
    const plugin = config.lastIndexOf("name: 'dev-csp'", relaxing);
    expect(plugin).toBeGreaterThan(-1);
    expect(config.slice(plugin, relaxing)).toContain("apply: 'serve'");
    expect(config.match(/unsafe-inline/g)).toHaveLength(1);
  });
});
