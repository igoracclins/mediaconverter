import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';

export default tseslint.config(
  {
    ignores: ['out/**', 'dist/**', 'release/**', 'resources/ffmpeg/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: [
      'src/preload/**/*.ts',
      'src/main/**/*.ts',
      'src/platform/**/*.ts',
      'src/shared/**/*.ts',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/renderer/**/*.{ts,vue}', 'src/shared/**/*.ts', 'src/core/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.nodeBuiltin } },
  },
  prettier,
);
