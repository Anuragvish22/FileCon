import { join } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', '..');
const importsElectron = "import { app } from 'electron';\nexport const electronApp = app;\n";
const LINT_TIMEOUT_MS = 30_000;

// Type info is off so paths need not exist on disk; these tests only care about syntax rules.
const ruleIds = async ({ filePath, code }: { filePath: string; code: string }) => {
  const eslint = new ESLint({ cwd: root, overrideConfig: tseslint.configs.disableTypeChecked });
  const [result] = await eslint.lintText(code, { filePath: join(root, filePath) });
  const ids = (result?.messages ?? []).map((message) => message.ruleId);
  // a null ruleId is a parse error, which would make "not.toContain" pass for the wrong reason
  expect(ids).not.toContain(null);
  return ids;
};

describe('lint rules', () => {
  it(
    'core may not import electron',
    async () => {
      const ids = await ruleIds({
        filePath: 'packages/core/src/example.ts',
        code: importsElectron,
      });
      expect(ids).toContain('no-restricted-imports');
    },
    LINT_TIMEOUT_MS,
  );

  it(
    'app may import electron',
    async () => {
      const ids = await ruleIds({
        filePath: 'packages/app/src/main/index.ts',
        code: importsElectron,
      });
      expect(ids).not.toContain('no-restricted-imports');
    },
    LINT_TIMEOUT_MS,
  );

  describe('naming rule', () => {
    const inSource = (code: string) => ruleIds({ filePath: 'packages/core/src/example.ts', code });

    it(
      'rejects one-letter names, anywhere',
      async () => {
        expect(await inSource('export const f = (x: number) => x;\n')).toContain('id-length');
        const inTest = await ruleIds({
          filePath: 'packages/core/test/example.test.ts',
          code: 'export const ids = [1].map((n) => n);\n',
        });
        expect(inTest).toContain('id-length');
      },
      LINT_TIMEOUT_MS,
    );

    it(
      'rejects a bare boolean argument in source, not a named field',
      async () => {
        const declare = 'const run = (options: unknown) => options;\n';
        expect(await inSource(`${declare}run(true);\n`)).toContain('no-restricted-syntax');
        expect(await inSource(`${declare}run({ fanOut: true });\n`)).not.toContain(
          'no-restricted-syntax',
        );
      },
      LINT_TIMEOUT_MS,
    );

    it(
      'rejects a magic number in source, not a named constant',
      async () => {
        const magic = 'export const late = (hops: number) => hops > 3;\n';
        expect(await inSource(magic)).toContain('@typescript-eslint/no-magic-numbers');
        const named =
          'const MAX_HOPS = 3;\nexport const late = (hops: number) => hops > MAX_HOPS;\n';
        expect(await inSource(named)).not.toContain('@typescript-eslint/no-magic-numbers');
      },
      LINT_TIMEOUT_MS,
    );

    it(
      'rejects 4 positional params',
      async () => {
        const fourParams =
          'export const join4 = (one: 1, two: 2, three: 3, four: 4) => [one, two, three, four];\n';
        expect(await inSource(fourParams)).toContain('max-params');
      },
      LINT_TIMEOUT_MS,
    );
  });
});
