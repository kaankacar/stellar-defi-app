import { defineConfig, loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load .env.production so integration tests have API keys
  const env = loadEnv('production', process.cwd(), 'NEXT_PUBLIC_');

  return {
    test: {
      environment: 'happy-dom',
      globals: true,
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      include: ['src/__tests__/integration.test.ts'],
      env,
    },
  };
});
