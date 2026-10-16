import js from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/dist/', '**/out/', '**/release/', 'docs/', '**/node_modules/'] },
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
    files: ['*.config.{js,ts}', 'eslint.config.js'],
    rules: { 'import-x/no-default-export': 'off' },
  },
);
