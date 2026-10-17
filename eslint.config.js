import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', '.cache/**', 'node_modules/*', 'playwright-report/**', 'test-results/**', 'blob-report/**'] },
  { files: ['**/*.ts', '**/*.tsx'], rules: { '@typescript-eslint/no-explicit-any': 'error', '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  // Playwright's fixture `use` callback is not a React hook.
  { files: ['tests/e2e/fixtures.ts'], rules: { 'react-hooks/rules-of-hooks': 'off', 'no-empty-pattern': 'off' } },
  { files: ['supabase/functions/**/*.ts', 'artifacts/*.function.ts'], rules: { 'import/no-unresolved': ['error', { ignore: ['^npm:'] }] } },
]);
