import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    // Override root setupFiles if they don't apply, or fix the path
    setupFiles: [],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/core/types.ts', '**/node_modules/**', '**/dist/**'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: {
      '@modules': path.resolve(__dirname, '../../modules'),
      '@nexical/sdk': path.resolve(__dirname, '../../node_modules/@nexical/sdk'), // fallback
    },
  },
});
