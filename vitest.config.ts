import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Default test run excludes integration tests (which hit real network)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/__tests__/integration.test.ts',
    ],
  },
});
