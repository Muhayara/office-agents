import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type http from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  AuthSetupError,
  LoginThrottle,
  createSessionValue,
  isAllowedHost,
  isAllowedOrigin,
  loadAuthConfig,
  roleForToken,
  verifySessionValue,
} from './auth';

const CEO = 'c'.repeat(40);
const VIEWER = 'v'.repeat(40);

function fakeReq(headers: Record<string, string>): http.IncomingMessage {
  return { headers } as unknown as http.IncomingMessage;
}

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'office-auth-test-'));
}

describe('security/auth', () => {
  it('membuat token acak di data/.office-token bila OFFICE_TOKEN kosong, dan memakainya ulang', () => {
    const root = tmpRoot();
    const first = loadAuthConfig({ rootDir: root, env: {} });
    expect(first.tokenSource).toBe('file');
    expect(first.ceoToken.length).toBeGreaterThanOrEqual(32);
    expect(fs.readFileSync(path.join(root, 'data', '.office-token'), 'utf8').trim()).toBe(first.ceoToken);

    const second = loadAuthConfig({ rootDir: root, env: {} });
    expect(second.ceoToken).toBe(first.ceoToken);
  });

  it('menolak token lemah atau token pengunjung yang sama dengan token CEO', () => {
    const root = tmpRoot();
    expect(() => loadAuthConfig({ rootDir: root, env: { OFFICE_TOKEN: 'pendek' } })).toThrow(AuthSetupError);
    expect(() =>
      loadAuthConfig({ rootDir: root, env: { OFFICE_TOKEN: CEO, OFFICE_VIEWER_TOKEN: CEO } }),
    ).toThrow(AuthSetupError);
  });

  it('memetakan token ke peran dan menolak token salah', () => {
    const cfg = loadAuthConfig({ rootDir: tmpRoot(), env: { OFFICE_TOKEN: CEO, OFFICE_VIEWER_TOKEN: VIEWER } });
    expect(roleForToken(cfg, CEO)).toBe('ceo');
    expect(roleForToken(cfg, VIEWER)).toBe('viewer');
    expect(roleForToken(cfg, `${CEO}x`)).toBeNull();
    expect(roleForToken(cfg, '')).toBeNull();
  });

  it('cookie sesi: valid, tidak bisa dipalsukan, dan kedaluwarsa', () => {
    const cfg = loadAuthConfig({ rootDir: tmpRoot(), env: { OFFICE_TOKEN: CEO, OFFICE_VIEWER_TOKEN: VIEWER } });
    const now = Date.now();
    const viewerCookie = createSessionValue(cfg, 'viewer', now);
    expect(verifySessionValue(cfg, viewerCookie, now)).toBe('viewer');

    // Mengganti peran viewer -> ceo merusak tanda tangan HMAC
    const forged = viewerCookie.replace('.viewer.', '.ceo.');
    expect(verifySessionValue(cfg, forged, now)).toBeNull();

    // Kedaluwarsa
    expect(verifySessionValue(cfg, viewerCookie, now + cfg.sessionTtlMs + 1)).toBeNull();

    // Ganti token CEO -> semua sesi lama batal
    const rotated = loadAuthConfig({ rootDir: tmpRoot(), env: { OFFICE_TOKEN: 'd'.repeat(40) } });
    expect(verifySessionValue(rotated, createSessionValue(cfg, 'ceo', now), now)).toBeNull();
  });

  it('memvalidasi Host (anti DNS rebinding) dan Origin', () => {
    const cfg = loadAuthConfig({
      rootDir: tmpRoot(),
      env: { OFFICE_TOKEN: CEO, OFFICE_ALLOWED_HOSTS: 'pc-kantor.tailnet.ts.net' },
      ports: [5173],
    });
    expect(isAllowedHost(cfg, fakeReq({ host: '127.0.0.1:7420' }))).toBe(true);
    expect(isAllowedHost(cfg, fakeReq({ host: 'localhost:5173' }))).toBe(true);
    expect(isAllowedHost(cfg, fakeReq({ host: 'pc-kantor.tailnet.ts.net:5173' }))).toBe(true);
    expect(isAllowedHost(cfg, fakeReq({ host: 'evil.example:7420' }))).toBe(false);
    expect(isAllowedHost(cfg, fakeReq({}))).toBe(false);

    expect(isAllowedOrigin(cfg, fakeReq({}))).toBe(true);
    expect(isAllowedOrigin(cfg, fakeReq({ origin: 'http://localhost:5173' }))).toBe(true);
    expect(isAllowedOrigin(cfg, fakeReq({ origin: 'http://localhost:3000' }))).toBe(false);
    expect(isAllowedOrigin(cfg, fakeReq({ origin: 'https://evil.example' }))).toBe(false);
    expect(isAllowedOrigin(cfg, fakeReq({ origin: 'null' }))).toBe(false);
  });

  it('membatasi percobaan login berulang', () => {
    const throttle = new LoginThrottle(3, 60_000);
    const now = Date.now();
    for (let i = 0; i < 3; i += 1) throttle.recordFailure('ip', now);
    expect(throttle.isBlocked('ip', now)).toBe(true);
    expect(throttle.isBlocked('ip', now + 61_000)).toBe(false);
  });
});
