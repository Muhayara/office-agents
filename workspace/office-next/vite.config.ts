import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@office/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://127.0.0.1:7420',
      '/ws': {
        target: 'ws://127.0.0.1:7420',
        ws: true,
      },
    },
  },
});
