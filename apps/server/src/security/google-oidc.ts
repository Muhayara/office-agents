import crypto from 'node:crypto';

/**
 * Login Google (OpenID Connect, authorization code + PKCE) — rencana-fpv-dan-kustomisasi-karakter.md §3.7 (F4).
 *
 * - `state` + `nonce` + PKCE S256; client secret hanya di server (.env), tidak pernah ke klien.
 * - ID token diverifikasi penuh: tanda tangan RS256 dengan JWKS Google (di-cache), `iss`, `aud`/`azp`,
 *   `exp`/`iat`, `nonce`, `email_verified`.
 * - Tanpa dependensi baru: hanya `node:crypto` + `fetch` bawaan Node (bisa diganti di tes).
 */

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
/** Toleransi selisih jam (detik) untuk exp / iat. */
const CLOCK_SKEW_S = 60;

export interface GoogleOidcConfig {
  clientId: string;
  clientSecret: string;
  /** Redirect URI bawaan (yang pertama). */
  redirectUri: string;
  /** Semua redirect URI terdaftar (mis. localhost + URL publik Funnel); dipilih sesuai host peminta. */
  redirectUris?: string[];
}

export class OidcError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
}

type FetchFn = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

export interface OidcDeps {
  fetch?: FetchFn;
  now?: () => number;
}

/** Baca konfigurasi dari env. null = login Google tidak aktif (tombolnya disembunyikan). */
export function loadGoogleConfig(env: NodeJS.ProcessEnv): GoogleOidcConfig | null {
  const clientId = (env.GOOGLE_CLIENT_ID ?? '').trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET ?? '').trim();
  if (!clientId || !clientSecret) return null;
  const list = (env.GOOGLE_REDIRECT_URI ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const redirectUris = list.length > 0 ? list : ['http://localhost:5174/api/auth/google/callback'];
  for (const uri of redirectUris) {
    let u: URL;
    try {
      u = new URL(uri);
    } catch {
      throw new OidcError('config', 'GOOGLE_REDIRECT_URI bukan URL yang valid.');
    }
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      throw new OidcError('config', `GOOGLE_REDIRECT_URI wajib https (kecuali localhost): ${u.host}`);
    }
    if (u.pathname !== '/api/auth/google/callback') {
      throw new OidcError('config', 'GOOGLE_REDIRECT_URI harus berakhir di /api/auth/google/callback.');
    }
  }
  return { clientId, clientSecret, redirectUri: redirectUris[0]!, redirectUris };
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Pasangan PKCE (verifier acak, challenge S256). */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomToken(48);
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function b64urlJson(part: string): Record<string, unknown> {
  try {
    const v = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ditolak di bawah */
  }
  throw new OidcError('token', 'ID token rusak.');
}

/** Nama tampilan aman (§3.3: huruf, angka, spasi, . ' -; maks 24). */
export function sanitizeDisplayName(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  const clean = s.normalize('NFC').replace(/[^\p{L}\p{N} .'\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24).trim();
  return clean || 'Tamu';
}

export function safeEqualStr(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export class GoogleOidc {
  private readonly fetchFn: FetchFn;
  private readonly now: () => number;
  private jwks = new Map<string, crypto.KeyObject>();
  private jwksExpiresAt = 0;
  private lastJwksFetch = 0;

  constructor(
    public readonly cfg: GoogleOidcConfig,
    deps: OidcDeps = {},
  ) {
    this.fetchFn = deps.fetch ?? (globalThis.fetch as unknown as FetchFn);
    this.now = deps.now ?? Date.now;
  }

  /** Redirect URI yang host-nya sama dengan host peminta (cookie state OAuth terikat host); bawaan = pertama. */
  redirectFor(host?: string): string {
    const list = this.cfg.redirectUris?.length ? this.cfg.redirectUris : [this.cfg.redirectUri];
    const h = (host ?? '').toLowerCase();
    return list.find((u) => new URL(u).host.toLowerCase() === h) ?? list[0]!;
  }

  authUrl(params: { state: string; nonce: string; codeChallenge: string; redirectUri?: string }): string {
    const u = new URL(GOOGLE_AUTH_URL);
    u.searchParams.set('client_id', this.cfg.clientId);
    u.searchParams.set('redirect_uri', params.redirectUri ?? this.cfg.redirectUri);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', 'openid email profile');
    u.searchParams.set('state', params.state);
    u.searchParams.set('nonce', params.nonce);
    u.searchParams.set('code_challenge', params.codeChallenge);
    u.searchParams.set('code_challenge_method', 'S256');
    u.searchParams.set('prompt', 'select_account');
    return u.toString();
  }

  /** Tukar kode otorisasi menjadi ID token (server ke server). */
  async exchangeCode(code: string, codeVerifier: string, redirectUri = this.cfg.redirectUri): Promise<string> {
    if (!/^[\w\-./~%]{8,2048}$/.test(code)) throw new OidcError('code', 'Kode otorisasi tidak valid.');
    const body = new URLSearchParams({
      code,
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }).toString();
    let res;
    try {
      res = await this.fetchFn(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
      });
    } catch {
      throw new OidcError('network', 'Server Google tidak terjangkau.');
    }
    const data = (await res.json().catch(() => ({}))) as { id_token?: unknown };
    if (!res.ok || typeof data.id_token !== 'string') {
      throw new OidcError('exchange', `Penukaran kode ditolak Google (HTTP ${res.status}).`);
    }
    return data.id_token;
  }

  private async loadJwks(force: boolean): Promise<void> {
    const now = this.now();
    if (!force && now < this.jwksExpiresAt && this.jwks.size > 0) return;
    // Paksa unduh ulang paling sering sekali per menit (kid tak dikenal tidak boleh membanjiri Google).
    if (force && now - this.lastJwksFetch < 60_000 && this.jwks.size > 0) return;
    this.lastJwksFetch = now;
    let res;
    try {
      res = await this.fetchFn(GOOGLE_JWKS_URL, { headers: { Accept: 'application/json' } });
    } catch {
      throw new OidcError('network', 'JWKS Google tidak terjangkau.');
    }
    if (!res.ok) throw new OidcError('jwks', `JWKS Google gagal dimuat (HTTP ${res.status}).`);
    const data = (await res.json().catch(() => ({}))) as { keys?: unknown };
    const next = new Map<string, crypto.KeyObject>();
    for (const k of Array.isArray(data.keys) ? data.keys : []) {
      const jwk = k as { kid?: unknown; kty?: unknown; n?: unknown; e?: unknown; use?: unknown };
      if (typeof jwk.kid !== 'string' || jwk.kty !== 'RSA' || typeof jwk.n !== 'string' || typeof jwk.e !== 'string') continue;
      if (jwk.use !== undefined && jwk.use !== 'sig') continue;
      try {
        next.set(jwk.kid, crypto.createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' }));
      } catch {
        /* lewati kunci rusak */
      }
    }
    if (next.size === 0) throw new OidcError('jwks', 'JWKS Google kosong.');
    this.jwks = next;
    const maxAge = /max-age=(\d+)/i.exec(res.headers.get('cache-control') ?? '')?.[1];
    const ttl = Math.min(Math.max(Number(maxAge ?? 3600), 60), 24 * 3600) * 1000;
    this.jwksExpiresAt = now + ttl;
  }

  /** Verifikasi ID token Google dan kembalikan identitas (melempar OidcError bila tidak sah). */
  async verifyIdToken(idToken: string, expectedNonce: string): Promise<GoogleIdentity> {
    const parts = idToken.split('.');
    if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) throw new OidcError('token', 'ID token rusak.');
    const [h, p, s] = parts as [string, string, string];
    const header = b64urlJson(h);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new OidcError('token', 'Algoritma ID token tidak didukung.');
    await this.loadJwks(false);
    let key = this.jwks.get(header.kid);
    if (!key) {
      await this.loadJwks(true);
      key = this.jwks.get(header.kid);
    }
    if (!key) throw new OidcError('signature', 'Kunci tanda tangan ID token tidak dikenal.');
    const valid = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), key, Buffer.from(s, 'base64url'));
    if (!valid) throw new OidcError('signature', 'Tanda tangan ID token tidak sah.');

    const c = b64urlJson(p);
    const nowS = Math.floor(this.now() / 1000);
    if (typeof c.iss !== 'string' || !GOOGLE_ISSUERS.has(c.iss)) throw new OidcError('issuer', 'Penerbit ID token bukan Google.');
    const audOk = c.aud === this.cfg.clientId || (Array.isArray(c.aud) && c.aud.includes(this.cfg.clientId) && c.azp === this.cfg.clientId);
    if (!audOk) throw new OidcError('audience', 'ID token bukan untuk aplikasi ini.');
    if (typeof c.exp !== 'number' || c.exp + CLOCK_SKEW_S < nowS) throw new OidcError('expired', 'ID token kedaluwarsa.');
    if (typeof c.iat === 'number' && c.iat - CLOCK_SKEW_S > nowS) throw new OidcError('token', 'ID token dari masa depan.');
    if (typeof c.nonce !== 'string' || !safeEqualStr(c.nonce, expectedNonce)) throw new OidcError('nonce', 'Nonce ID token tidak cocok.');
    if (typeof c.sub !== 'string' || !/^[\w-]{1,255}$/.test(c.sub)) throw new OidcError('token', 'Subjek ID token tidak valid.');
    if (c.email_verified !== true && c.email_verified !== 'true') throw new OidcError('email', 'Email akun Google belum terverifikasi.');
    const email = typeof c.email === 'string' ? c.email.slice(0, 254) : '';
    return { sub: c.sub, email, name: sanitizeDisplayName(c.name ?? c.given_name) };
  }
}
