import { defineConfig, mergeConfig } from 'vitest/config';
import path from 'node:path';
import baseConfig from './vitest.config.js';

export default defineConfig((config) => {
  const merged = mergeConfig(
    baseConfig,
    defineConfig({
      test: {
        setupFiles: [
          path.resolve(__dirname, '../../core/tests/integration/env-setup.ts'),
          path.resolve(__dirname, '../../core/tests/integration/setup.ts'),
        ],
        fileParallelism: false,
        coverage: {
          enabled: false,
        },
      },
    }),
  );

  // Overwrite include to only run integration tests
  merged.test.include = [path.resolve(__dirname, 'tests/integration/**/*.test.ts')];
  return merged;
});
