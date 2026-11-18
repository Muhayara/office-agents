import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { parseOfficeConfig } from '@office/shared';
import { OfficeDb } from './db';
import { OfficeCore } from './core/office-core';
import { createOfficeHttpServer } from './http-server';
import { clientKey, requestHost, setTrustProxy } from './http-util';
import { loadAuthConfig } from './security/auth';
import { GoogleOidc, loadGoogleConfig } from './security/google-oidc';
import { createStaticUi } from './static-ui';

/** Hosting publik (Tailscale Funnel): UI dari server, proxy tepercaya, redirect Google per host. */

const CEO = 'ceo-token-'.padEnd(40, 'x');
const servers: http.Server[] = [];
const dbs: OfficeDb[] = [];
afterEach(async () => {
  setTrustProxy(false);
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(() => r(null)))));
  for (const db of dbs.splice(0)) db.close();
});

interface Res { status: number; headers: http.IncomingHttpHeaders; body: Buffer }
function req(port: number, p: string, headers: Record<string, string> = {}, method = 'GET'): Promise<Res> {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path: p, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    r.on('error', reject);
    r.end();
  });
}

async function setup() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'office-hosting-test-'));
  const dist = path.join(tmp, 'dist');
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(dist, 'models'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
  fs.writeFileSync(path.join(dist, 'assets', 'app-abc.js'), 'console.log("kantor");'.repeat(200));
  fs.writeFileSync(path.join(dist, 'models', 'desk.glb'), Buffer.from([0x67, 0x6c, 0x54, 0x46]));
  fs.writeFileSync(path.join(tmp, 'rahasia.txt'), 'TOKEN-RAHASIA');
  const config = parseOfficeConfig(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../office.config.json'), 'utf8')));
  const db = new OfficeDb(':memory:');
  dbs.push(db);
  const core = new OfficeCore({ config, db, workspaceDir: tmp });
  const auth = loadAuthConfig({ rootDir: tmp, env: { OFFICE_TOKEN: CEO }, ports: [7420] });
  const { server } = createOfficeHttpServer({ core, scheduler: { checkGatewayHealth: async () => {} }, auth, workspaceDir: tmp, staticUi: createStaticUi(dist) });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  return (server.address() as AddressInfo).port;
}

describe('Hosting publik: UI dari server (OFFICE_SERVE_UI)', () => {
  it('melayani index + aset dengan CSP & cache yang benar; rute SPA → index.html', async () => {
    const port = await setup();
    const home = await req(port, '/');
    expect(home.status).toBe(200);
    expect(home.headers['content-type']).toContain('text/html');
    expect(home.headers['content-security-policy']).toContain("default-src 'self'");
    expect(home.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(home.headers['x-frame-options']).toBe('DENY');
    expect(home.headers['cache-control']).toBe('no-cache');
    const js = await req(port, '/assets/app-abc.js', { 'Accept-Encoding': 'gzip' });
    expect(js.headers['content-encoding']).toBe('gzip');
    expect(js.headers['cache-control']).toContain('immutable');
    expect(zlib.gunzipSync(js.body).toString()).toContain('kantor');
    const glb = await req(port, '/models/desk.glb');
    expect(glb.headers['content-type']).toBe('model/gltf-binary');
    expect((await req(port, '/kantor/ruang-rapat')).headers['content-type']).toContain('text/html');
    expect((await req(port, '/models/tidak-ada.glb')).status).toBe(404);
  });

  it('menolak path traversal & tidak pernah menimpa /api atau /ws', async () => {
    const port = await setup();
    for (const p of ['/../rahasia.txt', '/%2e%2e/rahasia.txt', '/assets/..%2f..%2frahasia.txt', '/..%5crahasia.txt']) {
      const r = await req(port, p);
      expect(r.body.toString()).not.toContain('TOKEN-RAHASIA');
    }
    const api = await req(port, '/api/tidak-ada');
    expect(api.status).toBe(404);
    expect(api.headers['content-type']).toContain('application/json');
    expect((await req(port, '/api/state')).status).toBe(401);
    expect((await req(port, '/', {}, 'POST')).status).toBe(404);
  });
});

describe('Proxy tepercaya (OFFICE_TRUST_PROXY) & redirect Google per host', () => {
  const fake = (remote: string, headers: Record<string, string>) =>
    ({ socket: { remoteAddress: remote }, headers }) as unknown as http.IncomingMessage;

  it('X-Forwarded-* hanya dipercaya dari loopback dan hanya bila diaktifkan', () => {
    const viaFunnel = fake('127.0.0.1', { 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'x-forwarded-host': 'kantor.tail1234.ts.net', host: '127.0.0.1:7420' });
    expect(clientKey(viaFunnel)).toBe('127.0.0.1');
    expect(requestHost(viaFunnel)).toBe('127.0.0.1:7420');
    setTrustProxy(true);
    expect(clientKey(viaFunnel)).toBe('203.0.113.7');
    expect(requestHost(viaFunnel)).toBe('kantor.tail1234.ts.net');
    // Klien LAN yang memalsukan header tidak dipercaya.
    const spoof = fake('192.168.1.50', { 'x-forwarded-for': '1.2.3.4', host: 'pc:7420' });
    expect(clientKey(spoof)).toBe('192.168.1.50');
    expect(requestHost(spoof)).toBe('pc:7420');
  });

  it('beberapa redirect URI: dipilih sesuai host; http non-localhost & path lain ditolak', () => {
    const cfg = loadGoogleConfig({
      GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:5174/api/auth/google/callback, https://kantor.tail1234.ts.net/api/auth/google/callback',
    })!;
    const g = new GoogleOidc(cfg);
    expect(g.redirectFor('kantor.tail1234.ts.net')).toBe('https://kantor.tail1234.ts.net/api/auth/google/callback');
    expect(g.redirectFor('localhost:5174')).toBe('http://localhost:5174/api/auth/google/callback');
    expect(g.redirectFor('evil.example.com')).toBe('http://localhost:5174/api/auth/google/callback');
    expect(() => loadGoogleConfig({ GOOGLE_CLIENT_ID: 'a', GOOGLE_CLIENT_SECRET: 'b', GOOGLE_REDIRECT_URI: 'https://kantor.example.com/lain' })).toThrow();
  });
});
