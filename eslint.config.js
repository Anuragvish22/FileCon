import js from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import react from 'eslint-plugin-react';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// A Tailwind class that names a physical side: ml-2, -pr-1, left-0, text-right, border-l, rounded-r-md.
const PHYSICAL_CLASS =
  /(^|[\s'"`:!])-?(?:(?:m|p)[lr]-|(?:left|right)-|text-(?:left|right)(?![\w-])|border-[lr](?![\w])|rounded-[lr](?![\w]))/;

export default defineConfig(
  { ignores: ['**/dist/', '**/out/', '**/release/', '**/coverage/', 'docs/', '**/node_modules/'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  // registers the plugin and makes it parse .ts files; without it no-cycle silently sees nothing
  importX.flatConfigs.typescript,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    settings: { 'import-x/resolver-next': [createTypeScriptImportResolver()] },
    rules: {
      // tsc already reports undefined names, and knows Node globals
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-default-export': 'error',
      // Naming rule (CLAUDE.md Code style): no one-letter names, `_` included. Object keys are exempt.
      'id-length': ['error', { min: 2, properties: 'never' }],
      // shortcut: layering zones (ARCHITECTURE section 4) are not enforced yet, add import-x/no-restricted-paths as the modules land in M0-2+
    },
  },
  {
    files: ['packages/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'electron', message: 'core never imports electron (CLAUDE.md hard rule 1)' },
          ],
          patterns: [
            {
              group: ['electron/*'],
              message: 'core never imports electron (CLAUDE.md hard rule 1)',
            },
          ],
        },
      ],
    },
  },
  {
    // No magic values at call sites (CLAUDE.md Code style). Tests are exempt: expect(value).toBe(true) and pixel sizes read fine there.
    files: ['packages/*/src/**', 'scripts/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            ':matches(CallExpression, NewExpression) > Literal.arguments[raw=/^(true|false)$/]',
          message: 'Pass a boolean as a named field ({ usedFanOut: false }), never bare',
        },
      ],
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [0, 1, -1],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],
      // 4+ positional params means an object param was due
      'max-params': ['error', 3],
    },
  },
  {
    // Every visible string comes from translate() (CLAUDE.md Code style)
    files: ['packages/app/src/renderer/**/*.tsx'],
    plugins: { react },
    rules: {
      'react/jsx-no-literals': ['error', { noStrings: true, ignoreProps: true }],
      // Logical properties only (UI-DESIGN section 8.9): ms-/me-/ps-/pe-/start-/end-, never left and right.
      // Replaces the block above for these files, so the boolean rule is repeated.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            ':matches(CallExpression, NewExpression) > Literal.arguments[raw=/^(true|false)$/]',
          message: 'Pass a boolean as a named field ({ usedFanOut: false }), never bare',
        },
        {
          selector: `Literal[value=${PHYSICAL_CLASS}]`,
          message:
            'Use logical utilities: ms-/me-, ps-/pe-, start-/end-, text-start/end, border-s/e, rounded-s/e',
        },
        {
          selector: `TemplateElement[value.cooked=${PHYSICAL_CLASS}]`,
          message:
            'Use logical utilities: ms-/me-, ps-/pe-, start-/end-, text-start/end, border-s/e, rounded-s/e',
        },
      ],
    },
  },
  {
    files: ['**/*.config.{js,ts}'],
    rules: { 'import-x/no-default-export': 'off' },
  },
);
