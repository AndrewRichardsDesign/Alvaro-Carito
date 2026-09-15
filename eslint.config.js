import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // shadcn primitives ship their variant helpers alongside the component.
    // Splitting them would mean re-splitting them on every upstream update.
    files: ['src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // A context provider and its hook belong in one file; the only cost is
    // that this one file does a full reload instead of a hot swap.
    files: ['src/content/ContentContext.tsx'],
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowExportNames: ['useContent', 'ADMIN_TARGET'] },
      ],
    },
  },
])
