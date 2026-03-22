import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      PUBLIC_API_URL: 'http://localhost:4321/api',
      NODE_ENV: 'test',
    },
    testTimeout: 120000,
    hookTimeout: 120000,
    include: ['tests/unit/**/*.test.ts'],
    // Unit tests do not need the integration setup
    setupFiles: [],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/core/types.ts', '**/node_modules/**', '**/dist/**'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../core/src'),
      '@modules': path.resolve(__dirname, '../../modules'),
      '@nexical/sdk': path.resolve(__dirname, '../../node_modules/@nexical/sdk'), // fallback
      '@tests': path.resolve(__dirname, '../../core/tests'),
    },
  },
});
