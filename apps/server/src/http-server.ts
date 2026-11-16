import fs from 'node:fs';
import http from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { formatZodError, parseClientCommand, type ServerEvent } from '@office/shared';
import type { OfficeCore } from './core/office-core';
import type { OfficeScheduler } from './core/scheduler';
import {
  type AuthConfig,
  LoginThrottle,
  type SessionRole,
  buildClearSessionCookie,
  buildSessionCookie,
  isAllowedHost,
  isAllowedOrigin,
  resolveRequestRole,
  roleForToken,
} from './security/auth';
import { HttpError, clientKey, readJsonBody, sendJson } from './http-util';

/** Batas body perintah CEO / login (pesan maks 4000 karakter). */
export const COMMAND_BODY_LIMIT = 64 * 1024;
/** Batas satu frame WebSocket dari klien. */
export const WS_MAX_PAYLOAD = 64 * 1024;

export interface OfficeHttpServer {
  server: http.Server;
  wss: WebSocketServer;
  broadcast: (event: ServerEvent) => void;
}

interface RouteContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  role: SessionRole | null;
}

function requireRole(ctx: RouteContext, needed: SessionRole): boolean {
  if (!ctx.role) {
    sendJson(ctx.res, 401, { ok: false, error: 'Belum login. Masukkan token CEO.' });
    return false;
  }
  if (needed === 'ceo' && ctx.role !== 'ceo') {
    sendJson(ctx.res, 403, { ok: false, error: 'Mode pengunjung hanya bisa melihat.' });
    return false;
  }
  return true;
}

function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  socket.write(
    `HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
  );
  socket.destroy();
}

export function createOfficeHttpServer(options: {
  core: OfficeCore;
  scheduler: Pick<OfficeScheduler, 'checkGatewayHealth'>;
  auth: AuthConfig;
  workspaceDir: string;
}): OfficeHttpServer {
  const { core, scheduler, auth, workspaceDir } = options;
  const throttle = new LoginThrottle();

  const server = http.createServer((req, res) => {
    void handleRequest(req, res).catch((err) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (err instanceof HttpError) {
        sendJson(res, err.status, { ok: false, error: err.message });
        return;
      }
      sendJson(res, 500, { ok: false, error: 'Kesalahan internal server' });
    });
  });

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!isAllowedHost(auth, req)) {
      sendJson(res, 421, { ok: false, error: 'Host tidak diizinkan' });
      return;
    }
    if (!isAllowedOrigin(auth, req)) {
      sendJson(res, 403, { ok: false, error: 'Origin tidak diizinkan' });
      return;
    }
    // Tanpa header CORS sama sekali: UI dilayani lewat proxy same-origin (Vite),
    // jadi preflight dari situs lain selalu gagal.
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { Allow: 'GET, POST, DELETE' });
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', 'http://office.local');
    const ctx: RouteContext = { req, res, url, role: resolveRequestRole(auth, req) };

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        serverTime: new Date().toISOString(),
        ...(ctx.role ? { gateway: core.getGatewayHealth() } : {}),
      });
      return;
    }

    if (url.pathname === '/api/session') {
      await handleSession(ctx);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      if (!requireRole(ctx, 'viewer')) return;
      sendJson(res, 200, core.getSnapshot());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/files') {
      if (!requireRole(ctx, 'ceo')) return;
      sendJson(res, 200, { files: core.walkWorkspaceDir(workspaceDir, 4) });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/file') {
      if (!requireRole(ctx, 'ceo')) return;
      const relPath = url.searchParams.get('path') ?? '';
      let full: string;
      try {
        full = core.resolveWorkspacePath(relPath);
      } catch {
        sendJson(res, 400, { ok: false, error: 'Path di luar workspace ditolak' });
        return;
      }
      if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        sendJson(res, 404, { ok: false, error: 'File tidak ditemukan' });
        return;
      }
      const content = fs.readFileSync(full, 'utf8').slice(0, 128_000);
      sendJson(res, 200, { path: relPath, content });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/runs') {
      if (!requireRole(ctx, 'ceo')) return;
      const agentParam = url.searchParams.get('agent') ?? undefined;
      const agentId = agentParam ? core.resolveAgent(agentParam)?.id : undefined;
      if (agentParam && !agentId) {
        sendJson(res, 404, { ok: false, error: 'Agen tidak ditemukan' });
        return;
      }
      const limit = Number(url.searchParams.get('limit') ?? '10');
      sendJson(res, 200, { runs: core.listRuns({ agentId, limit: Number.isFinite(limit) ? limit : 10 }) });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/command') {
      if (!requireRole(ctx, 'ceo')) return;
      const raw = await readJsonBody(req, COMMAND_BODY_LIMIT);
      const parsed = parseClientCommand(raw);
      if (!parsed.success) {
        sendJson(res, 400, { ok: false, error: formatZodError(parsed.error) });
        return;
      }
      try {
        core.handleClientCommand(parsed.data);
      } catch (err) {
        sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/gateway/check') {
      if (!requireRole(ctx, 'ceo')) return;
      await scheduler.checkGatewayHealth();
      sendJson(res, 200, core.getGatewayHealth());
      return;
    }

    sendJson(res, 404, { ok: false, error: 'Not Found' });
  }

  async function handleSession(ctx: RouteContext): Promise<void> {
    const { req, res } = ctx;
    if (req.method === 'GET') {
      sendJson(res, 200, {
        authenticated: ctx.role !== null,
        role: ctx.role,
        tokenSource: auth.tokenSource,
        viewerEnabled: Boolean(auth.viewerToken),
      });
      return;
    }

    if (req.method === 'POST') {
      const key = clientKey(req);
      if (throttle.isBlocked(key)) {
        sendJson(res, 429, { ok: false, error: 'Terlalu banyak percobaan. Coba lagi 1 menit lagi.' });
        return;
      }
      const body = (await readJsonBody(req, 4096)) as { token?: unknown } | null;
      const token = typeof body?.token === 'string' ? body.token : '';
      const role = roleForToken(auth, token);
      if (!role) {
        throttle.recordFailure(key);
        sendJson(res, 401, { ok: false, error: 'Token salah.' });
        return;
      }
      throttle.reset(key);
      sendJson(res, 200, { ok: true, role }, { 'Set-Cookie': buildSessionCookie(auth, role) });
      return;
    }

    if (req.method === 'DELETE') {
      sendJson(res, 200, { ok: true }, { 'Set-Cookie': buildClearSessionCookie(auth) });
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Method tidak didukung' });
  }

  /* ---------------------------- WebSocket ---------------------------- */

  const wss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD });
  const roles = new WeakMap<WebSocket, SessionRole>();

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://office.local');
    if (url.pathname !== '/ws') {
      rejectUpgrade(socket, 404, 'Not Found');
      return;
    }
    if (!isAllowedHost(auth, req)) {
      rejectUpgrade(socket, 421, 'Misdirected Request');
      return;
    }
    if (!isAllowedOrigin(auth, req)) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }
    const role = resolveRequestRole(auth, req);
    if (!role) {
      rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      roles.set(ws, role);
      wss.emit('connection', ws, req);
    });
  });

  const sendError = (ws: WebSocket, code: string, message: string) => {
    const errEvent: ServerEvent = { type: 'error', code, message, at: new Date().toISOString() };
    ws.send(JSON.stringify(errEvent));
  };

  wss.on('connection', (ws: WebSocket) => {
    const snapshotEvent: ServerEvent = {
      type: 'state.snapshot',
      state: core.getSnapshot(),
      at: new Date().toISOString(),
    };
    ws.send(JSON.stringify(snapshotEvent));

    ws.on('message', (data) => {
      if (roles.get(ws) !== 'ceo') {
        sendError(ws, 'FORBIDDEN', 'Mode pengunjung hanya bisa melihat.');
        return;
      }
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(data.toString());
      } catch {
        sendError(ws, 'PARSE_ERROR', 'JSON tidak valid');
        return;
      }
      const parsedCmd = parseClientCommand(parsedJson);
      if (!parsedCmd.success) {
        sendError(ws, 'INVALID_COMMAND', formatZodError(parsedCmd.error));
        return;
      }
      try {
        core.handleClientCommand(parsedCmd.data);
      } catch (err) {
        sendError(ws, 'COMMAND_FAILED', err instanceof Error ? err.message : String(err));
      }
    });
  });

  const broadcast = (event: ServerEvent) => {
    const payload = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  };

  return { server, wss, broadcast };
}
