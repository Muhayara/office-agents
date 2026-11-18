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
  type Principal,
  buildClearOAuthCookie,
  buildClearSessionCookie,
  buildOAuthCookie,
  buildSessionCookie,
  buildUserSessionCookie,
  canReadOffice,
  isAllowedHost,
  isAllowedOrigin,
  readOAuthCookie,
  resolvePrincipal,
  roleForToken,
} from './security/auth';
import { type GoogleOidc, OidcError, pkcePair, randomToken, safeEqualStr } from './security/google-oidc';
import type { OfficeUsers, UserRole } from './users';
import { HttpError, clientKey, readJsonBody, requestHost, sendJson } from './http-util';
import type { StaticUiHandler } from './static-ui';

/** Batas body perintah CEO / login (pesan maks 4000 karakter). */
export const COMMAND_BODY_LIMIT = 64 * 1024;
/** Batas satu frame WebSocket dari klien. */
export const WS_MAX_PAYLOAD = 64 * 1024;

export interface OfficeHttpServer {
  server: http.Server;
  wss: WebSocketServer;
  broadcast: (event: ServerEvent) => void;
}

/** Penangan upgrade tambahan (mis. kanal dunia `/ws/world`, F2). true = sudah ditangani. */
export type UpgradeHandler = (req: http.IncomingMessage, socket: Duplex, head: Buffer, principal: Principal | null) => boolean;

interface RouteContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  principal: Principal | null;
}

type Need = 'login' | 'office' | 'ceo';

function requireRole(ctx: RouteContext, needed: Need): boolean {
  const role = ctx.principal?.role ?? null;
  if (!role) {
    sendJson(ctx.res, 401, { ok: false, error: 'Belum login.' });
    return false;
  }
  if (needed === 'office' && !canReadOffice(role)) {
    sendJson(ctx.res, 403, { ok: false, error: 'Akun tamu hanya bisa menonton kantor.' });
    return false;
  }
  if (needed === 'ceo' && role !== 'ceo') {
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

function redirect(res: http.ServerResponse, location: string, cookies: string[] = []): void {
  res.writeHead(302, {
    Location: location,
    'Cache-Control': 'no-store',
    ...(cookies.length > 0 ? { 'Set-Cookie': cookies } : {}),
  });
  res.end();
}

export function createOfficeHttpServer(options: {
  core: OfficeCore;
  scheduler: Pick<OfficeScheduler, 'checkGatewayHealth'>;
  auth: AuthConfig;
  workspaceDir: string;
  /** Akun Google (F4). Tanpa ini cookie v2 selalu ditolak. */
  users?: OfficeUsers;
  /** Login Google. null/undefined = tombol Google tidak aktif. */
  google?: GoogleOidc | null;
  /** Kanal tambahan (mis. `/ws/world`). */
  upgrades?: Record<string, UpgradeHandler>;
  /** UI hasil build (hosting publik satu port). */
  staticUi?: StaticUiHandler | null;
}): OfficeHttpServer {
  const { core, scheduler, auth, workspaceDir, users, google } = options;
  const throttle = new LoginThrottle();
  const lookup = users ? (id: string) => users.get(id) : undefined;

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
    const ctx: RouteContext = { req, res, url, principal: resolvePrincipal(auth, req, lookup) };

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        serverTime: new Date().toISOString(),
        ...(canReadOffice(ctx.principal?.role) ? { gateway: core.getGatewayHealth() } : {}),
      });
      return;
    }

    if (url.pathname === '/api/session') {
      await handleSession(ctx);
      return;
    }

    if (url.pathname === '/api/auth/google' || url.pathname === '/api/auth/google/callback') {
      await handleGoogle(ctx);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/me') {
      if (!requireRole(ctx, 'login')) return;
      const p = ctx.principal!;
      sendJson(res, 200, { role: p.role, user: p.userId ? { id: p.userId, name: p.name } : null });
      return;
    }

    if (url.pathname === '/api/users' || url.pathname === '/api/users/update') {
      await handleUsers(ctx);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      if (!requireRole(ctx, 'office')) return;
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

    if (options.staticUi?.(req, res, url)) return;

    sendJson(res, 404, { ok: false, error: 'Not Found' });
  }

  async function handleSession(ctx: RouteContext): Promise<void> {
    const { req, res } = ctx;
    if (req.method === 'GET') {
      const p = ctx.principal;
      sendJson(res, 200, {
        authenticated: p !== null,
        role: p?.role ?? null,
        user: p?.userId ? { id: p.userId, name: p.name } : null,
        tokenSource: auth.tokenSource,
        viewerEnabled: Boolean(auth.viewerToken),
        googleEnabled: Boolean(google && users),
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

  /** Login Google: `/api/auth/google` → Google → `/api/auth/google/callback` → kembali ke `/`. */
  async function handleGoogle(ctx: RouteContext): Promise<void> {
    const { req, res, url } = ctx;
    if (req.method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'Method tidak didukung' });
      return;
    }
    if (!google || !users) {
      sendJson(res, 404, { ok: false, error: 'Login Google belum dikonfigurasi (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).' });
      return;
    }
    const fail = (code: string) => redirect(res, `/?login_error=${encodeURIComponent(code)}`, [buildClearOAuthCookie(auth)]);
    // Host peminta menentukan redirect URI (localhost:5174 saat dev, URL Funnel saat publik).
    const redirectUri = google.redirectFor(requestHost(req));

    if (url.pathname === '/api/auth/google') {
      const { verifier, challenge } = pkcePair();
      const pending = { state: randomToken(24), nonce: randomToken(24), verifier };
      redirect(res, google.authUrl({ state: pending.state, nonce: pending.nonce, codeChallenge: challenge, redirectUri }), [buildOAuthCookie(auth, pending)]);
      return;
    }

    // ---- Callback ----
    const key = clientKey(req);
    if (throttle.isBlocked(key)) {
      fail('throttled');
      return;
    }
    if (url.searchParams.get('error')) {
      fail('cancelled');
      return;
    }
    const pending = readOAuthCookie(auth, req);
    const state = url.searchParams.get('state') ?? '';
    if (!pending || !state || !safeEqualStr(state, pending.state)) {
      throttle.recordFailure(key);
      fail('state');
      return;
    }
    const code = url.searchParams.get('code') ?? '';
    try {
      const idToken = await google.exchangeCode(code, pending.verifier, redirectUri);
      const identity = await google.verifyIdToken(idToken, pending.nonce);
      const user = users.upsertGoogle(identity);
      if (user.blocked) {
        fail('blocked');
        return;
      }
      throttle.reset(key);
      redirect(res, '/?login=google', [buildClearOAuthCookie(auth), buildUserSessionCookie(auth, user.id)]);
    } catch (err) {
      throttle.recordFailure(key);
      fail(err instanceof OidcError ? err.code : 'internal');
    }
  }

  /** Panel CEO: daftar akun Google, naikkan/turunkan karyawan, blokir. */
  async function handleUsers(ctx: RouteContext): Promise<void> {
    const { req, res, url } = ctx;
    if (!requireRole(ctx, 'ceo')) return;
    if (!users) {
      sendJson(res, 404, { ok: false, error: 'Akun pengguna tidak aktif.' });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/users') {
      sendJson(res, 200, { users: users.list() });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/users/update') {
      const body = (await readJsonBody(req, 2048)) as { id?: unknown; role?: unknown; blocked?: unknown } | null;
      const id = typeof body?.id === 'string' ? body.id : '';
      const role = body?.role === 'guest' || body?.role === 'employee' ? (body.role as UserRole) : undefined;
      const blocked = typeof body?.blocked === 'boolean' ? body.blocked : undefined;
      if (body?.role !== undefined && role === undefined) {
        sendJson(res, 400, { ok: false, error: 'Peran harus guest atau employee.' });
        return;
      }
      if (role === undefined && blocked === undefined) {
        sendJson(res, 400, { ok: false, error: 'Tidak ada perubahan.' });
        return;
      }
      const updated = users.update(id, { role, blocked });
      if (!updated) {
        sendJson(res, 404, { ok: false, error: 'Pengguna tidak ditemukan.' });
        return;
      }
      sendJson(res, 200, { ok: true, user: updated });
      return;
    }
    sendJson(res, 405, { ok: false, error: 'Method tidak didukung' });
  }

  /* ---------------------------- WebSocket ---------------------------- */

  const wss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD });
  const roles = new WeakMap<WebSocket, Principal>();

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://office.local');
    const extra = options.upgrades?.[url.pathname];
    if (url.pathname !== '/ws' && !extra) {
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
    const principal = resolvePrincipal(auth, req, lookup);
    if (extra) {
      if (!extra(req, socket, head, principal)) rejectUpgrade(socket, 404, 'Not Found');
      return;
    }
    if (!principal) {
      rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }
    if (!canReadOffice(principal.role)) {
      rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      roles.set(ws, principal);
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
      if (roles.get(ws)?.role !== 'ceo') {
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
