// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  ...tseslint.config(
    {
      ignores: ['eslint.config.mjs'],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    eslintPluginPrettierRecommended,
    {
      languageOptions: {
        globals: {
          ...globals.node,
          ...globals.jest,
        },
        sourceType: 'commonjs',
        parserOptions: {
          projectService: true,
          tsconfigRootDir: process.cwd(),
        },
      },
    },
    {
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-floating-promises': 'warn',
        '@typescript-eslint/no-unsafe-argument': 'warn'
      },
    },
    {
      settings: {
        'import/resolver': {
          typescript: {},
          node: { extensions: ['.ts', '.js'] },
        },
        'import/extensions': ['.ts', '.js'],
      },
    }
  ),
  // Disable unsafe rules for polyfill and main
  { files: ['src/crypto-polyfill.ts', 'src/main.ts'], rules: { '@typescript-eslint/no-unsafe-assignment': 'off', '@typescript-eslint/no-unsafe-member-access': 'off', '@typescript-eslint/no-floating-promises': 'off' } },
  // Relax rules for chat module
  { files: ['src/chat/**/*.ts'], rules: { '@typescript-eslint/no-unused-vars': 'off', '@typescript-eslint/no-floating-promises': 'off', '@typescript-eslint/require-await': 'off' } },
  // Relax rules for test files
  { files: ['src/**/*.spec.ts', 'test/**/*.ts'], rules: { '@typescript-eslint/unbound-method': 'off', '@typescript-eslint/require-await': 'off' } },
  // Relax rules for guards and controllers
  { files: ['src/auth/guards/**/*.ts', 'src/me/**/*.ts'], rules: { '@typescript-eslint/no-unused-vars': 'off' } },
  // Relax rules for rooms module
  { files: ['src/rooms/**/*.ts'], rules: { '@typescript-eslint/no-unused-vars': 'off', '@typescript-eslint/no-namespace': 'off' } },
  // Relax unsafe rules for all source files (excluding tests and main polyfill)
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts', 'src/main.ts', 'src/crypto-polyfill.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/await-thenable': 'off',
      'no-empty': 'off',
    },
  },
];