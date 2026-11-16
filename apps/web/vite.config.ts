import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig(({ mode }) => {
  // Hanya OFFICE_ALLOWED_HOSTS yang dibaca dari .env root (untuk akses Tailscale/LAN);
  // nilainya dipakai di konfigurasi dev server saja, tidak pernah dikirim ke browser.
  const env = loadEnv(mode, ROOT_DIR, 'OFFICE_ALLOWED_HOSTS');
  const extraHosts = (env.OFFICE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);

  return {
    plugins: [react()],
    server: {
      port: 5173,
      allowedHosts: extraHosts.length > 0 ? extraHosts : undefined,
      proxy: {
        '/api': 'http://127.0.0.1:7420',
        '/ws': {
          target: 'ws://127.0.0.1:7420',
          ws: true,
        },
      },
    },
  };
});
