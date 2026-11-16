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

export function clientKey(req: http.IncomingMessage): string {
  return req.socket.remoteAddress ?? 'unknown';
}
