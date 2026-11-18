import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { parseOfficeConfig } from '@office/shared';
import { OfficeDb } from './db';
import { OfficeCore } from './core/office-core';
import { createOfficeHttpServer } from './http-server';
import { SESSION_COOKIE_NAME, createUserSessionValue, loadAuthConfig } from './security/auth';
import { GoogleOidc } from './security/google-oidc';
import { OfficeUsers } from './users';

/** F4: alur login Google lengkap lewat HTTP + simulasi serangan (JWKS & token endpoint tiruan). */

const CEO = 'ceo-token-'.padEnd(40, 'x');
const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: 'jwk' }) as Record<string, string>), kid: 'k1', use: 'sig' };

function idToken(claims: Record<string, unknown>): string {
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url');
  const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${h}.${p}.${crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url')}`;
}

function claims(nonce: string, extra: Record<string, unknown> = {}) {
  const s = Math.floor(Date.now() / 1000);
  return { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'google-sub-1', email: 'tamu@example.com', email_verified: true, name: 'Budi Tamu', nonce, iat: s, exp: s + 3600, ...extra };
}

interface Res { status: number; headers: http.IncomingHttpHeaders; body: string }
function req(port: number, opts: { method?: string; path: string; headers?: Record<string, string>; body?: string }): Promise<Res> {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method: opts.method ?? 'GET', path: opts.path, headers: { ...(opts.body ? { 'Content-Length': Buffer.byteLength(opts.body) } : {}), ...opts.headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    r.on('error', reject);
    if (opts.body) r.write(opts.body);
    r.end();
  });
}
const cookieOf = (res: Res, name: string) => (res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`)) ?? '';

const servers: http.Server[] = [];
const dbs: OfficeDb[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(() => r(null)))));
  for (const db of dbs.splice(0)) db.close();
});

function baseSetup() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-google-test-'));
  const config = parseOfficeConfig(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../office.config.json'), 'utf8')));
  const db = new OfficeDb(':memory:');
  dbs.push(db);
  const core = new OfficeCore({ config, db, workspaceDir: tmpDir });
  const auth = loadAuthConfig({ rootDir: tmpDir, env: { OFFICE_TOKEN: CEO }, ports: [5174] });
  return { tmpDir, db, core, auth, users: new OfficeUsers(db) };
}

async function setup() {
  const { tmpDir, core, auth, users } = baseSetup();
  const tokenState = { next: '' as string };
  const google = new GoogleOidc(
    { clientId: CLIENT_ID, clientSecret: 'shh', redirectUri: 'http://localhost:5174/api/auth/google/callback' },
    {
      fetch: async (url) => url.includes('/certs')
        ? { ok: true, status: 200, headers: { get: () => 'max-age=600' }, json: async () => ({ keys: [jwk] }) }
        : { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ id_token: tokenState.next }) },
    },
  );
  const { server } = createOfficeHttpServer({ core, scheduler: { checkGatewayHealth: async () => {} }, auth, workspaceDir: tmpDir, users, google });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  return { port: (server.address() as AddressInfo).port, users, auth, tokenState };
}

/** Mulai login: kembalikan cookie OAuth, state, dan nonce dari redirect ke Google. */
async function begin(port: number) {
  const res = await req(port, { path: '/api/auth/google' });
  expect(res.status).toBe(302);
  const loc = new URL(res.headers.location!);
  const oauth = cookieOf(res, 'office_oauth');
  expect(oauth).toContain('SameSite=Lax');
  expect(oauth).toContain('HttpOnly');
  return { oauth: oauth.split(';')[0]!, state: loc.searchParams.get('state')!, nonce: loc.searchParams.get('nonce')! };
}

async function ceoCookie(port: number) {
  const res = await req(port, { method: 'POST', path: '/api/session', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: CEO }) });
  return cookieOf(res, SESSION_COOKIE_NAME).split(';')[0]!;
}

describe('Login Google & peran (F4)', () => {
  it('alur lengkap: tamu → hanya /api/me; CEO menaikkan ke karyawan → /api/state; blokir → keluar', async () => {
    const { port, tokenState } = await setup();
    const sess = await req(port, { path: '/api/session' });
    expect(JSON.parse(sess.body).googleEnabled).toBe(true);

    const { oauth, state, nonce } = await begin(port);
    tokenState.next = idToken(claims(nonce));
    const cb = await req(port, { path: `/api/auth/google/callback?code=kode-otorisasi-1&state=${state}`, headers: { Cookie: oauth } });
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe('/?login=google');
    const sc = cookieOf(cb, SESSION_COOKIE_NAME);
    expect(sc).toContain('SameSite=Strict');
    expect(sc).toContain('HttpOnly');
    const guest = sc.split(';')[0]!;

    const me = await req(port, { path: '/api/me', headers: { Cookie: guest } });
    expect(me.status).toBe(200);
    const meBody = JSON.parse(me.body);
    expect(meBody.role).toBe('guest');
    expect(meBody.user.name).toBe('Budi Tamu');
    expect(JSON.stringify(meBody)).not.toContain('tamu@example.com');

    expect((await req(port, { path: '/api/state', headers: { Cookie: guest } })).status).toBe(403);
    const cmd = await req(port, { method: 'POST', path: '/api/command', headers: { Cookie: guest, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'office.pause', paused: true }) });
    expect(cmd.status).toBe(403);
    expect((await req(port, { path: '/api/users', headers: { Cookie: guest } })).status).toBe(403);

    const ceo = await ceoCookie(port);
    const list = JSON.parse((await req(port, { path: '/api/users', headers: { Cookie: ceo } })).body).users;
    expect(list).toHaveLength(1);
    expect(list[0].email).toBe('tamu@example.com');
    const upd = await req(port, { method: 'POST', path: '/api/users/update', headers: { Cookie: ceo, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: list[0].id, role: 'employee' }) });
    expect(upd.status).toBe(200);
    // Peran dibaca dari DB setiap request: cookie lama langsung naik pangkat.
    expect((await req(port, { path: '/api/state', headers: { Cookie: guest } })).status).toBe(200);
    // Karyawan tetap tidak bisa memerintah agen.
    expect((await req(port, { method: 'POST', path: '/api/command', headers: { Cookie: guest, 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(403);

    await req(port, { method: 'POST', path: '/api/users/update', headers: { Cookie: ceo, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: list[0].id, blocked: true }) });
    expect((await req(port, { path: '/api/me', headers: { Cookie: guest } })).status).toBe(401);
    // Login ulang akun yang diblokir ditolak.
    const again = await begin(port);
    tokenState.next = idToken(claims(again.nonce));
    const cb2 = await req(port, { path: `/api/auth/google/callback?code=kode-otorisasi-2&state=${again.state}`, headers: { Cookie: again.oauth } });
    expect(cb2.headers.location).toBe('/?login_error=blocked');
  });

  it('menolak state palsu, cookie OAuth hilang/dipalsukan, nonce dari sesi lain, aud lain, dan token kedaluwarsa', async () => {
    const { port, tokenState } = await setup();
    const a = await begin(port);
    tokenState.next = idToken(claims(a.nonce));
    const bad = (r: Res, code: string) => {
      expect(r.status).toBe(302);
      expect(r.headers.location).toBe(`/?login_error=${code}`);
      expect(cookieOf(r, SESSION_COOKIE_NAME)).toBe('');
    };
    bad(await req(port, { path: `/api/auth/google/callback?code=kode-otorisasi-1&state=state-palsu`, headers: { Cookie: a.oauth } }), 'state');
    bad(await req(port, { path: `/api/auth/google/callback?code=kode-otorisasi-1&state=${a.state}` }), 'state');
    const forgedCookie = a.oauth.replace(/\.[^.]+$/, '.AAAA');
    bad(await req(port, { path: `/api/auth/google/callback?code=kode-otorisasi-1&state=${a.state}`, headers: { Cookie: forgedCookie } }), 'state');
    // Penyerang memakai ID token yang dibuat untuk nonce sesi lain.
    const b = await begin(port);
    tokenState.next = idToken(claims(a.nonce));
    bad(await req(port, { path: `/api/auth/google/callback?code=kode-otorisasi-1&state=${b.state}`, headers: { Cookie: b.oauth } }), 'nonce');
    tokenState.next = idToken(claims(b.nonce, { aud: 'aplikasi-lain' }));
    bad(await req(port, { path: `/api/auth/google/callback?code=kode-otorisasi-1&state=${b.state}`, headers: { Cookie: b.oauth } }), 'audience');
    tokenState.next = idToken(claims(b.nonce, { exp: Math.floor(Date.now() / 1000) - 7200 }));
    bad(await req(port, { path: `/api/auth/google/callback?code=kode-otorisasi-1&state=${b.state}`, headers: { Cookie: b.oauth } }), 'expired');
  });

  it('cookie v2 dipalsukan, subjek ditukar, atau milik akun yang tidak ada ditolak', async () => {
    const { port, users, auth } = await setup();
    const u = users.upsertGoogle({ sub: 's1', name: 'Asli', email: 'a@example.com' });
    const v = users.upsertGoogle({ sub: 's2', name: 'Korban', email: 'b@example.com' });
    users.update(v.id, { role: 'employee' });
    const good = createUserSessionValue(auth, u.id);
    expect((await req(port, { path: '/api/me', headers: { Cookie: `${SESSION_COOKIE_NAME}=${good}` } })).status).toBe(200);
    // Tukar userId ke akun karyawan dengan tanda tangan lama.
    const swapped = good.replace(u.id, v.id);
    expect((await req(port, { path: '/api/me', headers: { Cookie: `${SESSION_COOKIE_NAME}=${swapped}` } })).status).toBe(401);
    // Perpanjang masa berlaku tanpa tanda tangan baru.
    const parts = good.split('.');
    const extended = [parts[0], parts[1], String(Date.now() + 10 ** 12), parts[3]].join('.');
    expect((await req(port, { path: '/api/me', headers: { Cookie: `${SESSION_COOKIE_NAME}=${extended}` } })).status).toBe(401);
    const ghost = createUserSessionValue(auth, 'u_AAAAAAAAAAAAAAAAAAAAAA');
    expect((await req(port, { path: '/api/me', headers: { Cookie: `${SESSION_COOKIE_NAME}=${ghost}` } })).status).toBe(401);
    // Cookie v2 tidak pernah memberi hak CEO.
    const ceoTry = await req(port, { path: '/api/runs', headers: { Cookie: `${SESSION_COOKIE_NAME}=${createUserSessionValue(auth, v.id)}` } });
    expect(ceoTry.status).toBe(403);
  });

  it('tanpa konfigurasi Google, endpoint OAuth = 404 dan googleEnabled false', async () => {
    const { tmpDir, core, auth, users } = baseSetup();
    const { server } = createOfficeHttpServer({ core, scheduler: { checkGatewayHealth: async () => {} }, auth, workspaceDir: tmpDir, users });
    servers.push(server);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as AddressInfo).port;
    expect((await req(port, { path: '/api/auth/google' })).status).toBe(404);
    expect(JSON.parse((await req(port, { path: '/api/session' })).body).googleEnabled).toBe(false);
  });
});
