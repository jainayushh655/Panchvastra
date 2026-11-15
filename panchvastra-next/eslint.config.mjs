import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import { defineConfig } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

/**
 * ESLint flat config.
 *
 * Mirrors the Vite application's `eslint.config.js` — same plugins, same parser setup,
 * same rule overrides — so a file moved between the two applications lints identically
 * and the migration does not generate a wave of style churn.
 *
 * Two deliberate differences:
 *
 *  1. `@next/eslint-plugin-next` is added for the Next-specific correctness rules
 *     (`no-html-link-for-pages`, `no-img-element`, `no-sync-scripts`, …). The plugin is
 *     used directly rather than through `eslint-config-next`, which would pull in a
 *     second copy of the TypeScript and React Hooks plugins at versions that may not
 *     match the ones the rest of this project already pins.
 *
 *  2. `react-refresh` is absent. It exists to police Vite's Fast Refresh boundaries;
 *     Next's own compiler handles that, and the Vite config had the rule switched off
 *     anyway.
 */
export default defineConfig([
  {
    ignores: ['.next', 'node_modules', 'next-env.d.ts'],
  },

  {
    files: ['src/**/*.{ts,tsx}'],

    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },

    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs['recommended-latest'].rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,

      // Matches the Vite config exactly, for the reasons recorded there.
      'no-undef': 'off',
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // Config files run in Node. `next.config.ts` is TypeScript, so it needs the TS parser
    // as well — without it ESLint falls back to the default parser and chokes on the first
    // type annotation.
    files: ['next.config.ts', 'postcss.config.mjs', 'eslint.config.mjs'],
    plugins: {
      '@typescript-eslint': tseslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      'no-undef': 'off',
    },
  },
])
