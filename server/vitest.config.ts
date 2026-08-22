// @ts-nocheck
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    include: ['**/*.{test,spec}.{js,ts}'],
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test'
    }
  },
});
