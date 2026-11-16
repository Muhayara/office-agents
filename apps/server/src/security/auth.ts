import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type http from 'node:http';

/**
 * Autentikasi Office Server.
 *
 * - Token CEO (`OFFICE_TOKEN`) memberi kendali penuh. Bila tidak diisi di .env,
 *   server membuat token acak sekali lalu menyimpannya di `data/.office-token`
 *   (folder `data/` sudah di-gitignore).
 * - Token pengunjung opsional (`OFFICE_VIEWER_TOKEN`) hanya boleh membaca state.
 * - Browser login sekali lewat `POST /api/session`, lalu memakai cookie HttpOnly
 *   + SameSite=Strict yang ditandatangani HMAC (tetap berlaku setelah restart).
 * - Klien non-browser (MCP, skrip) memakai header `Authorization: Bearer <token>`.
 * - Host dan Origin divalidasi untuk menutup CSRF, cross-site WebSocket hijacking,
 *   dan DNS rebinding.
 */

export type SessionRole = 'ceo' | 'viewer';

export const SESSION_COOKIE_NAME = 'office_agents_session';
export const MIN_TOKEN_LENGTH = 24;
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE_VERSION = 'v1';

export interface AuthConfig {
  ceoToken: string;
  viewerToken?: string;
  tokenSource: 'env' | 'file';
  tokenFile?: string;
  allowedHosts: ReadonlySet<string>;
  allowedOrigins: ReadonlySet<string>;
  secureCookie: boolean;
  sessionTtlMs: number;
}

export class AuthSetupError extends Error {}

function splitList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeOrigin(raw: string): string | null {
  try {
    return new URL(raw).origin.toLowerCase();
  } catch {
    return null;
  }
}

function hostnameOf(hostHeader: string): string | null {
  try {
    return new URL(`http://${hostHeader}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function readOrCreateTokenFile(tokenFile: string): string {
  if (fs.existsSync(tokenFile)) {
    const existing = fs.readFileSync(tokenFile, 'utf8').trim();
    if (existing.length >= MIN_TOKEN_LENGTH) return existing;
  }
  fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
  const token = crypto.randomBytes(32).toString('base64url');
  fs.writeFileSync(tokenFile, `${token}\n`, { encoding: 'utf8', mode: 0o600 });
  return token;
}

export function loadAuthConfig(options: {
  rootDir: string;
  env?: NodeJS.ProcessEnv;
  /** Port tempat UI dilayani (Vite dev server) dan port server sendiri. */
  ports?: number[];
}): AuthConfig {
  const env = options.env ?? process.env;
  const ports = options.ports ?? [5173, 5174, 7420];

  const envToken = (env.OFFICE_TOKEN ?? '').trim();
  let ceoToken: string;
  let tokenSource: AuthConfig['tokenSource'];
  let tokenFile: string | undefined;

  if (envToken) {
    if (envToken.length < MIN_TOKEN_LENGTH) {
      throw new AuthSetupError(
        `OFFICE_TOKEN terlalu pendek (minimal ${MIN_TOKEN_LENGTH} karakter). Kosongkan agar server membuat token acak di data/.office-token.`,
      );
    }
    ceoToken = envToken;
    tokenSource = 'env';
  } else {
    tokenFile = path.join(options.rootDir, 'data', '.office-token');
    ceoToken = readOrCreateTokenFile(tokenFile);
    tokenSource = 'file';
  }

  const viewerRaw = (env.OFFICE_VIEWER_TOKEN ?? '').trim();
  let viewerToken: string | undefined;
  if (viewerRaw) {
    if (viewerRaw.length < MIN_TOKEN_LENGTH) {
      throw new AuthSetupError(
        `OFFICE_VIEWER_TOKEN terlalu pendek (minimal ${MIN_TOKEN_LENGTH} karakter).`,
      );
    }
    if (viewerRaw === ceoToken) {
      throw new AuthSetupError('OFFICE_VIEWER_TOKEN tidak boleh sama dengan token CEO.');
    }
    viewerToken = viewerRaw;
  }

  const allowedHosts = new Set<string>(['localhost', '127.0.0.1', '[::1]']);
  for (const h of splitList(env.OFFICE_ALLOWED_HOSTS)) {
    const name = hostnameOf(h);
    if (name) allowedHosts.add(name);
  }

  const allowedOrigins = new Set<string>();
  for (const port of ports) {
    allowedOrigins.add(`http://localhost:${port}`);
    allowedOrigins.add(`http://127.0.0.1:${port}`);
  }
  for (const o of splitList(env.OFFICE_ALLOWED_ORIGINS)) {
    const origin = normalizeOrigin(o);
    if (origin) allowedOrigins.add(origin);
  }

  const ttlDays = Number(env.OFFICE_SESSION_DAYS ?? '');
  const sessionTtlMs =
    Number.isFinite(ttlDays) && ttlDays > 0 && ttlDays <= 365
      ? ttlDays * 24 * 60 * 60 * 1000
      : DEFAULT_SESSION_TTL_MS;

  return {
    ceoToken,
    viewerToken,
    tokenSource,
    tokenFile,
    allowedHosts,
    allowedOrigins,
    secureCookie: env.OFFICE_COOKIE_SECURE === '1' || env.OFFICE_COOKIE_SECURE === 'true',
    sessionTtlMs,
  };
}

/* ------------------------------------------------------------------ */
/* Token & cookie                                                      */
/* ------------------------------------------------------------------ */

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Memetakan token mentah ke peran (perbandingan waktu-konstan). */
export function roleForToken(cfg: AuthConfig, candidate: string | undefined | null): SessionRole | null {
  if (!candidate) return null;
  const token = candidate.trim();
  if (!token) return null;
  if (safeEqual(token, cfg.ceoToken)) return 'ceo';
  if (cfg.viewerToken && safeEqual(token, cfg.viewerToken)) return 'viewer';
  return null;
}

function sessionKey(cfg: AuthConfig): Buffer {
  return crypto
    .createHash('sha256')
    .update(`office-session:${cfg.ceoToken}:${cfg.viewerToken ?? ''}`)
    .digest();
}

function sign(cfg: AuthConfig, payload: string): string {
  return crypto.createHmac('sha256', sessionKey(cfg)).update(payload).digest('base64url');
}

export function createSessionValue(cfg: AuthConfig, role: SessionRole, now = Date.now()): string {
  const payload = `${COOKIE_VERSION}.${role}.${now + cfg.sessionTtlMs}`;
  return `${payload}.${sign(cfg, payload)}`;
}

export function verifySessionValue(
  cfg: AuthConfig,
  value: string | undefined,
  now = Date.now(),
): SessionRole | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [version, role, expRaw, sig] = parts as [string, string, string, string];
  if (version !== COOKIE_VERSION) return null;
  if (role !== 'ceo' && role !== 'viewer') return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= now) return null;
  const expected = sign(cfg, `${version}.${role}.${expRaw}`);
  if (!safeEqual(sig, expected)) return null;
  if (role === 'viewer' && !cfg.viewerToken) return null;
  return role;
}

export function buildSessionCookie(cfg: AuthConfig, role: SessionRole): string {
  const maxAge = Math.floor(cfg.sessionTtlMs / 1000);
  const parts = [
    `${SESSION_COOKIE_NAME}=${createSessionValue(cfg, role)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];
  if (cfg.secureCookie) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearSessionCookie(cfg: AuthConfig): string {
  const parts = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (cfg.secureCookie) parts.push('Secure');
  return parts.join('; ');
}

function readCookie(req: http.IncomingMessage, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return part.slice(idx + 1).trim();
    }
  }
  return undefined;
}

function bearerFrom(req: http.IncomingMessage): string | undefined {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const alt = req.headers['x-office-token'];
  return typeof alt === 'string' ? alt.trim() : undefined;
}

export interface AuthResolveOptions {
  /** Terima cookie sesi browser (HTTP API & WS). MCP hanya menerima Bearer. */
  allowCookie?: boolean;
}

/** Peran peminta, atau null bila tidak terautentikasi. */
export function resolveRequestRole(
  cfg: AuthConfig,
  req: http.IncomingMessage,
  options: AuthResolveOptions = {},
): SessionRole | null {
  const bearer = bearerFrom(req);
  if (bearer) return roleForToken(cfg, bearer);
  if (options.allowCookie ?? true) {
    return verifySessionValue(cfg, readCookie(req, SESSION_COOKIE_NAME));
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Host / Origin                                                       */
/* ------------------------------------------------------------------ */

/** Host header wajib menunjuk ke host yang diizinkan (anti DNS rebinding). */
export function isAllowedHost(cfg: AuthConfig, req: http.IncomingMessage): boolean {
  const host = req.headers.host;
  if (!host) return false;
  const name = hostnameOf(host);
  return name !== null && cfg.allowedHosts.has(name);
}

/**
 * Origin hanya dicek bila ada (browser selalu mengirimnya untuk request lintas situs
 * dan upgrade WebSocket). Klien non-browser tidak mengirim Origin dan tetap wajib token.
 */
export function isAllowedOrigin(cfg: AuthConfig, req: http.IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  if (typeof origin !== 'string' || origin === 'null') return false;
  const normalized = normalizeOrigin(origin);
  return normalized !== null && cfg.allowedOrigins.has(normalized);
}

/* ------------------------------------------------------------------ */
/* Pembatas percobaan login                                            */
/* ------------------------------------------------------------------ */

export class LoginThrottle {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxFailures = 10,
    private readonly windowMs = 60_000,
  ) {}

  public isBlocked(key: string, now = Date.now()): boolean {
    const entry = this.attempts.get(key);
    if (!entry) return false;
    if (entry.resetAt <= now) {
      this.attempts.delete(key);
      return false;
    }
    return entry.count >= this.maxFailures;
  }

  public recordFailure(key: string, now = Date.now()): void {
    const entry = this.attempts.get(key);
    if (!entry || entry.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }
    entry.count += 1;
  }

  public reset(key: string): void {
    this.attempts.delete(key);
  }
}
