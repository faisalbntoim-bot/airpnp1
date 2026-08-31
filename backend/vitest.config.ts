import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: false,
    reporters: 'default',
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/env.ts'],
    fileParallelism: false,
  },
});
