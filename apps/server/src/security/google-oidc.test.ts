import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GoogleOidc, OidcError, loadGoogleConfig, pkcePair, sanitizeDisplayName } from './google-oidc';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...(publicKey.export({ format: 'jwk' }) as Record<string, string>), kid: 'kid-1', use: 'sig', alg: 'RS256' };

function signIdToken(claims: Record<string, unknown>, opts: { kid?: string; key?: crypto.KeyObject; alg?: string } = {}): string {
  const header = Buffer.from(JSON.stringify({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? 'kid-1', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), opts.key ?? privateKey).toString('base64url');
  return `${header}.${payload}.${sig}`;
}

function validClaims(nonce: string, extra: Record<string, unknown> = {}) {
  const s = Math.floor(NOW / 1000);
  return {
    iss: 'https://accounts.google.com', aud: CLIENT_ID, azp: CLIENT_ID, sub: '1234567890',
    email: 'tamu@example.com', email_verified: true, name: 'Budi <b>Tamu</b>', nonce, iat: s - 10, exp: s + 3600, ...extra,
  };
}

function makeOidc(tokenResponse?: unknown) {
  let jwksFetches = 0;
  const fetch = async (url: string) => {
    if (url.includes('/certs')) {
      jwksFetches++;
      return { ok: true, status: 200, headers: { get: () => 'public, max-age=600' }, json: async () => ({ keys: [jwk] }) };
    }
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => tokenResponse ?? {} };
  };
  const oidc = new GoogleOidc({ clientId: CLIENT_ID, clientSecret: 'secret', redirectUri: 'http://localhost:5174/api/auth/google/callback' }, { fetch, now: () => NOW });
  return { oidc, jwksFetches: () => jwksFetches };
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(OidcError);
  await p.catch((e: OidcError) => expect(e.code).toBe(code));
}

describe('security/google-oidc (F4)', () => {
  it('konfigurasi: nonaktif tanpa client id/secret, redirect non-https ditolak kecuali localhost', () => {
    expect(loadGoogleConfig({})).toBeNull();
    expect(loadGoogleConfig({ GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b' })?.redirectUri).toBe('http://localhost:5174/api/auth/google/callback');
    expect(() => loadGoogleConfig({ GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b', GOOGLE_REDIRECT_URI: 'http://kantor.example.com/cb' })).toThrow(OidcError);
  });

  it('URL otorisasi memuat state, nonce, PKCE S256, dan scope minimal', () => {
    const { oidc } = makeOidc();
    const { verifier, challenge } = pkcePair();
    expect(crypto.createHash('sha256').update(verifier).digest('base64url')).toBe(challenge);
    const u = new URL(oidc.authUrl({ state: 'st', nonce: 'nn', codeChallenge: challenge }));
    expect(u.origin).toBe('https://accounts.google.com');
    expect(u.searchParams.get('scope')).toBe('openid email profile');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('state')).toBe('st');
    expect(u.searchParams.get('nonce')).toBe('nn');
    expect(u.searchParams.get('client_secret')).toBeNull();
  });

  it('menerima ID token sah dan membersihkan nama tampilan', async () => {
    const { oidc } = makeOidc();
    const id = await oidc.verifyIdToken(signIdToken(validClaims('n1')), 'n1');
    expect(id).toEqual({ sub: '1234567890', email: 'tamu@example.com', name: 'Budi bTamub' });
    expect(sanitizeDisplayName('<script>alert(1)</script>')).toBe('scriptalert1script');
    expect(sanitizeDisplayName('')).toBe('Tamu');
  });

  it('menolak nonce palsu, aud lain, kedaluwarsa, iss palsu, email belum terverifikasi', async () => {
    const { oidc } = makeOidc();
    await expectCode(oidc.verifyIdToken(signIdToken(validClaims('n1')), 'nonce-lain'), 'nonce');
    await expectCode(oidc.verifyIdToken(signIdToken(validClaims('n1', { aud: 'aplikasi-lain' })), 'n1'), 'audience');
    await expectCode(oidc.verifyIdToken(signIdToken(validClaims('n1', { exp: Math.floor(NOW / 1000) - 3600 })), 'n1'), 'expired');
    await expectCode(oidc.verifyIdToken(signIdToken(validClaims('n1', { iss: 'https://evil.example.com' })), 'n1'), 'issuer');
    await expectCode(oidc.verifyIdToken(signIdToken(validClaims('n1', { email_verified: false })), 'n1'), 'email');
  });

  it('menolak tanda tangan kunci lain, alg none/HS256, kid tak dikenal, dan token rusak', async () => {
    const { oidc, jwksFetches } = makeOidc();
    await expectCode(oidc.verifyIdToken(signIdToken(validClaims('n1'), { key: other.privateKey }), 'n1'), 'signature');
    await expectCode(oidc.verifyIdToken(signIdToken(validClaims('n1'), { alg: 'none' }), 'n1'), 'token');
    await expectCode(oidc.verifyIdToken(signIdToken(validClaims('n1'), { alg: 'HS256' }), 'n1'), 'token');
    await expectCode(oidc.verifyIdToken(signIdToken(validClaims('n1'), { kid: 'kid-x' }), 'n1'), 'signature');
    await expectCode(oidc.verifyIdToken('a.b', 'n1'), 'token');
    // Payload diubah setelah ditandatangani (sub ditukar) -> tanda tangan tidak cocok.
    const [h, , s] = signIdToken(validClaims('n1')).split('.');
    const forged = `${h}.${Buffer.from(JSON.stringify(validClaims('n1', { sub: '999' }))).toString('base64url')}.${s}`;
    await expectCode(oidc.verifyIdToken(forged, 'n1'), 'signature');
    // JWKS di-cache: kid tak dikenal hanya memicu satu unduhan ulang per menit.
    expect(jwksFetches()).toBeLessThanOrEqual(2);
  });

  it('penukaran kode gagal bila Google tidak mengembalikan id_token', async () => {
    const { oidc } = makeOidc({ error: 'invalid_grant' });
    await expectCode(oidc.exchangeCode('kode-otorisasi-123', 'v'), 'exchange');
    await expectCode(oidc.exchangeCode('x', 'v'), 'code');
  });
});
