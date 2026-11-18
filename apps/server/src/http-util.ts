import type http from 'node:http';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(JSON.stringify(body));
}

export function isJsonContentType(req: http.IncomingMessage): boolean {
  const ct = req.headers['content-type'];
  if (typeof ct !== 'string') return false;
  return ct.split(';')[0]!.trim().toLowerCase() === 'application/json';
}

/**
 * Membaca body JSON dengan batas ukuran. `Content-Type: application/json` wajib:
 * request lintas situs dengan tipe ini selalu memicu preflight CORS yang ditolak server,
 * sehingga form/`text/plain` dari situs lain tidak bisa memicu aksi.
 */
export async function readJsonBody(req: http.IncomingMessage, maxBytes: number): Promise<unknown> {
  if (!isJsonContentType(req)) {
    throw new HttpError(415, 'Content-Type wajib application/json');
  }
  const declared = Number(req.headers['content-length'] ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, `Body melebihi batas ${maxBytes} byte`);
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buf.length;
    if (total > maxBytes) {
      throw new HttpError(413, `Body melebihi batas ${maxBytes} byte`);
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'JSON tidak valid');
  }
}

let trustProxy = false;

/**
 * Hosting publik (Tailscale Funnel / reverse proxy lokal): percayai `X-Forwarded-For` / `-Host`
 * HANYA bila koneksinya datang dari loopback (daemon proxy di PC yang sama). Bawaan: mati.
 */
export function setTrustProxy(on: boolean): void {
  trustProxy = on;
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const viaTrustedProxy = (req: http.IncomingMessage) => trustProxy && LOOPBACK.has(req.socket.remoteAddress ?? '');
const firstHeader = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim();

/** Kunci pembatas per klien (IP asli bila lewat proxy tepercaya). */
export function clientKey(req: http.IncomingMessage): string {
  if (viaTrustedProxy(req)) {
    const ip = firstHeader(req.headers['x-forwarded-for']);
    if (ip && ip.length <= 64) return ip;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/** Host yang dilihat peramban (untuk memilih redirect URI Google). */
export function requestHost(req: http.IncomingMessage): string {
  if (viaTrustedProxy(req)) {
    const h = firstHeader(req.headers['x-forwarded-host']);
    if (h && h.length <= 255) return h.toLowerCase();
  }
  return String(req.headers.host ?? '').toLowerCase();
}
