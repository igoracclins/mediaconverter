import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@core': resolve(__dirname, 'src/core'),
      '@conversion': resolve(__dirname, 'src/conversion'),
      '@platform': resolve(__dirname, 'src/platform'),
      '@main': resolve(__dirname, 'src/main'),
    },
  },
  test: {
    name: 'integration',
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
