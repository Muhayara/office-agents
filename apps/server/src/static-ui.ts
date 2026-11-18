import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type http from 'node:http';

/**
 * Melayani UI kantor 3D hasil `npm run build:next` dari server yang sama (hosting publik lewat
 * Tailscale Funnel: satu port untuk UI + API + WebSocket, cookie tetap same-origin).
 *
 * - Hanya GET/HEAD, path dinormalisasi dan wajib tetap di dalam folder build (anti path traversal).
 * - Rute tanpa ekstensi → `index.html` (SPA). `/api/*`, `/ws*` tidak pernah dilayani di sini.
 * - CSP ketat (tanpa skrip inline / sumber eksternal); `wasm-unsafe-eval` untuk dekoder meshopt.
 * - JS/CSS/HTML/JSON dikompres gzip sekali lalu di-cache di memori (hemat bandwidth Funnel).
 */

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt']);

export const UI_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // GLTFLoader memuat tekstur GLB lewat fetch(blob:) / data: URI.
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export type StaticUiHandler = (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => boolean;

/** null bila folder build tidak ada (jalankan `npm run build:next` dulu). */
export function createStaticUi(dir: string): StaticUiHandler | null {
  const root = path.resolve(dir);
  const indexFile = path.join(root, 'index.html');
  if (!fs.existsSync(indexFile)) return null;
  const gzCache = new Map<string, { mtime: number; buf: Buffer }>();

  const resolveFile = (pathname: string): string | null => {
    let rel: string;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    if (rel.includes('\0') || rel.includes('\\')) return null;
    const full = path.resolve(root, `.${path.posix.normalize(`/${rel}`)}`);
    if (full !== root && !full.startsWith(root + path.sep)) return null;
    try {
      if (fs.statSync(full).isFile()) return full;
    } catch {
      /* tidak ada */
    }
    // Rute SPA (tanpa ekstensi) → index.html; berkas aset yang hilang tetap 404.
    return path.extname(rel) === '' ? indexFile : null;
  };

  return (req, res, url) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    if (url.pathname.startsWith('/api/') || url.pathname === '/api' || url.pathname.startsWith('/ws')) return false;
    const file = resolveFile(url.pathname === '/' ? '/index.html' : url.pathname);
    if (!file) return false;
    const ext = path.extname(file).toLowerCase();
    const relUrl = path.relative(root, file).split(path.sep).join('/');
    const headers: Record<string, string> = {
      ...SECURITY_HEADERS,
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': relUrl.startsWith('assets/')
        ? 'public, max-age=31536000, immutable'
        : relUrl.startsWith('models/') ? 'public, max-age=604800' : 'no-cache',
    };
    if (ext === '.html') headers['Content-Security-Policy'] = UI_CSP;

    const acceptsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    if (COMPRESSIBLE.has(ext) && acceptsGzip) {
      const mtime = fs.statSync(file).mtimeMs;
      let hit = gzCache.get(file);
      if (!hit || hit.mtime !== mtime) {
        hit = { mtime, buf: zlib.gzipSync(fs.readFileSync(file), { level: 9 }) };
        gzCache.set(file, hit);
      }
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding', 'Content-Length': String(hit.buf.length) });
      res.end(req.method === 'HEAD' ? undefined : hit.buf);
      return true;
    }
    const size = fs.statSync(file).size;
    res.writeHead(200, { ...headers, 'Content-Length': String(size) });
    if (req.method === 'HEAD') {
      res.end();
      return true;
    }
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
    return true;
  };
}
