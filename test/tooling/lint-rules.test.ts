import { join } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..');
const code = "import { app } from 'electron';\nexport const a = app;\n";

// Type info is off so paths need not exist on disk; these tests only care about import rules.
const ruleIds = async (filePath: string) => {
  const eslint = new ESLint({ cwd: root, overrideConfig: tseslint.configs.disableTypeChecked });
  const [result] = await eslint.lintText(code, { filePath: join(root, filePath) });
  return (result?.messages ?? []).map((m) => m.ruleId);
};

describe('lint rules', () => {
  it('core may not import electron', async () => {
    expect(await ruleIds('packages/core/src/x.ts')).toContain('no-restricted-imports');
  }, 30_000);

  it('app may import electron', async () => {
    const ids = await ruleIds('packages/app/src/main/index.ts');
    // a null ruleId is a parse error, which would make this pass for the wrong reason
    expect(ids).not.toContain(null);
    expect(ids).not.toContain('no-restricted-imports');
  }, 30_000);
});
