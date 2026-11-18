import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const ROOT_DIR = path.resolve(__dirname, '../..');

/**
 * `vite build --mode demo` menghasilkan build statis tanpa backend (VITE_DEMO=1):
 * dipakai untuk hosting gratis (Cloudflare Pages / Netlify / GitHub Pages).
 * Sengaja tidak memakai file `.env.demo` karena pola `.env.*` diblokir pemindai keamanan.
 */
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
    resolve: {
      alias: [
        { find: '@office/shared', replacement: path.resolve(__dirname, '../../packages/shared/src/index.ts') },
        // Paket dunia bersama (F2): `@office/world` dan subpath `@office/world/<modul>`.
        { find: /^@office\/world\/(.+)$/, replacement: path.resolve(__dirname, '../../packages/world/src') + '/$1.ts' },
        { find: /^@office\/world$/, replacement: path.resolve(__dirname, '../../packages/world/src/index.ts') },
      ],
    },
    define: mode === 'demo' ? { 'import.meta.env.VITE_DEMO': JSON.stringify('1') } : {},
    server: {
      port: 5174,
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
