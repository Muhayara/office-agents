import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { parseOfficeConfig } from '@office/shared';
import { OfficeDb } from './db';
import { OfficeCore } from './core/office-core';
import { createOfficeHttpServer } from './http-server';
import { createMcpHttpServer } from './mcp-server';
import { SESSION_COOKIE_NAME, loadAuthConfig } from './security/auth';

const CEO = 'ceo-token-'.padEnd(40, 'x');
const VIEWER = 'viewer-token-'.padEnd(40, 'y');

interface RawResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function rawRequest(
  port: number,
  opts: { method?: string; path: string; headers?: Record<string, string>; body?: string },
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method: opts.method ?? 'GET',
        path: opts.path,
        headers: { ...(opts.body ? { 'Content-Length': Buffer.byteLength(opts.body) } : {}), ...opts.headers },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }),
        );
      },
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

const servers: http.Server[] = [];
const dbs: OfficeDb[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(() => r(null)))));
  for (const db of dbs.splice(0)) db.close();
});

async function setup() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-http-test-'));
  const config = parseOfficeConfig(
    JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../office.config.json'), 'utf8')),
  );
  const db = new OfficeDb(':memory:');
  dbs.push(db);
  const core = new OfficeCore({ config, db, workspaceDir: tmpDir });
  const auth = loadAuthConfig({
    rootDir: tmpDir,
    env: { OFFICE_TOKEN: CEO, OFFICE_VIEWER_TOKEN: VIEWER },
    ports: [5173],
  });

  const { server, broadcast } = createOfficeHttpServer({
    core,
    scheduler: { checkGatewayHealth: async () => {} },
    auth,
    workspaceDir: tmpDir,
  });
  core.onEvent(broadcast);
  const mcp = createMcpHttpServer({ core, auth });
  servers.push(server, mcp);

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  await new Promise<void>((r) => mcp.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;
  const mcpPort = (mcp.address() as AddressInfo).port;
  return { core, tmpDir, port, mcpPort };
}

async function loginCookie(port: number, token: string): Promise<string> {
  const res = await rawRequest(port, {
    method: 'POST',
    path: '/api/session',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  expect(res.status).toBe(200);
  const setCookie = res.headers['set-cookie']?.[0] ?? '';
  expect(setCookie).toContain('HttpOnly');
  expect(setCookie).toContain('SameSite=Strict');
  return setCookie.split(';')[0]!;
}

function wsConnect(
  port: number,
  headers: Record<string, string>,
): Promise<{ ws?: WebSocket; status?: number; firstMessage?: unknown }> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers });
    ws.on('unexpected-response', (_req, res) => resolve({ status: res.statusCode }));
    ws.on('error', () => resolve({ status: -1 }));
    ws.once('message', (data) => resolve({ ws, firstMessage: JSON.parse(data.toString()) }));
  });
}

describe('HTTP/WS/MCP hardening (P0)', () => {
  it('menolak akses tanpa login, Origin asing, dan Host asing (DNS rebinding)', async () => {
    const { port } = await setup();

    const anon = await rawRequest(port, { path: '/api/state' });
    expect(anon.status).toBe(401);
    expect(anon.headers['access-control-allow-origin']).toBeUndefined();

    const evilOrigin = await rawRequest(port, {
      path: '/api/state',
      headers: { Origin: 'https://evil.example', Authorization: `Bearer ${CEO}` },
    });
    expect(evilOrigin.status).toBe(403);

    const rebinding = await rawRequest(port, {
      path: '/api/state',
      headers: { Host: `evil.example:${port}`, Authorization: `Bearer ${CEO}` },
    });
    expect(rebinding.status).toBe(421);

    const health = await rawRequest(port, { path: '/health' });
    expect(health.status).toBe(200);
    expect(JSON.parse(health.body).gateway).toBeUndefined();
  });

  it('menolak POST text/plain (CSRF tanpa preflight) dan body raksasa', async () => {
    const { core, port } = await setup();
    const csrf = await rawRequest(port, {
      method: 'POST',
      path: '/api/command',
      headers: { 'Content-Type': 'text/plain', Authorization: `Bearer ${CEO}` },
      body: JSON.stringify({ type: 'office.setMode', mode: 'full' }),
    });
    expect(csrf.status).toBe(415);
    expect(core.getMode()).toBe('semi');

    const huge = await rawRequest(port, {
      method: 'POST',
      path: '/api/command',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CEO}` },
      body: JSON.stringify({ type: 'ceo.send', to: 'manager', text: 'a'.repeat(70 * 1024) }),
    });
    expect(huge.status).toBe(413);
  });

  it('login CEO lewat cookie bisa memberi perintah; pengunjung hanya bisa melihat', async () => {
    const { core, port } = await setup();

    const wrong = await rawRequest(port, {
      method: 'POST',
      path: '/api/session',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'salah' }),
    });
    expect(wrong.status).toBe(401);

    const ceoCookie = await loginCookie(port, CEO);
    const state = await rawRequest(port, { path: '/api/state', headers: { Cookie: ceoCookie } });
    expect(state.status).toBe(200);
    expect(JSON.parse(state.body).agents).toHaveLength(10);

    const cmd = await rawRequest(port, {
      method: 'POST',
      path: '/api/command',
      headers: { 'Content-Type': 'application/json', Cookie: ceoCookie, Origin: 'http://localhost:5173' },
      body: JSON.stringify({ type: 'office.setMode', mode: 'full' }),
    });
    expect(cmd.status).toBe(200);
    expect(core.getMode()).toBe('full');

    const viewerCookie = await loginCookie(port, VIEWER);
    const viewerState = await rawRequest(port, { path: '/api/state', headers: { Cookie: viewerCookie } });
    expect(viewerState.status).toBe(200);
    const viewerCmd = await rawRequest(port, {
      method: 'POST',
      path: '/api/command',
      headers: { 'Content-Type': 'application/json', Cookie: viewerCookie },
      body: JSON.stringify({ type: 'office.setMode', mode: 'semi' }),
    });
    expect(viewerCmd.status).toBe(403);
    expect(core.getMode()).toBe('full');

    const viewerFiles = await rawRequest(port, { path: '/api/files', headers: { Cookie: viewerCookie } });
    expect(viewerFiles.status).toBe(403);

    // Cookie dipalsukan ditolak
    const forged = await rawRequest(port, {
      path: '/api/state',
      headers: { Cookie: `${SESSION_COOKIE_NAME}=v1.ceo.9999999999999.palsu` },
    });
    expect(forged.status).toBe(401);
  });

  it('WebSocket menolak tanpa sesi & Origin asing; pengunjung tidak bisa mengirim perintah', async () => {
    const { core, port } = await setup();

    expect((await wsConnect(port, {})).status).toBe(401);

    const ceoCookie = await loginCookie(port, CEO);
    expect((await wsConnect(port, { Cookie: ceoCookie, Origin: 'https://evil.example' })).status).toBe(403);

    const ok = await wsConnect(port, { Cookie: ceoCookie, Origin: 'http://localhost:5173' });
    expect((ok.firstMessage as { type: string }).type).toBe('state.snapshot');
    ok.ws?.close();

    const viewerCookie = await loginCookie(port, VIEWER);
    const viewer = await wsConnect(port, { Cookie: viewerCookie });
    expect(viewer.ws).toBeDefined();
    const reply = await new Promise<{ type: string; code?: string }>((resolve) => {
      viewer.ws!.on('message', (data) => {
        const evt = JSON.parse(data.toString()) as { type: string; code?: string };
        if (evt.type === 'error') resolve(evt);
      });
      viewer.ws!.send(JSON.stringify({ type: 'office.setMode', mode: 'full' }));
    });
    expect(reply.code).toBe('FORBIDDEN');
    expect(core.getMode()).toBe('semi');
    viewer.ws?.close();
  });

  it('MCP wajib Bearer token dan menolak agen tak terdaftar (bypass guard peran)', async () => {
    const { mcpPort, tmpDir } = await setup();
    const call = (headers: Record<string, string>, agent: string, body: unknown) =>
      rawRequest(mcpPort, {
        method: 'POST',
        path: `/mcp?agent=${agent}`,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });

    const list = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    expect((await call({}, 'laras', list)).status).toBe(401);
    expect((await call({ Authorization: 'Bearer salah' }, 'laras', list)).status).toBe(401);

    // Serangan dari audit: agent palsu + write_file
    const forgedWrite = await call({ Authorization: `Bearer ${CEO}` }, 'penyusup', {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'write_file', arguments: { path: 'pwned.txt', content: 'x' } },
    });
    expect(forgedWrite.status).toBe(403);
    expect(fs.existsSync(path.join(tmpDir, 'pwned.txt'))).toBe(false);

    const ok = await call({ Authorization: `Bearer ${CEO}` }, 'laras', list);
    expect(ok.status).toBe(200);
    expect(JSON.parse(ok.body).result.tools.length).toBeGreaterThan(10);

    // Peran tetap ditegakkan untuk agen terdaftar: reviewer tidak boleh menulis file
    const reviewerWrite = await call({ Authorization: `Bearer ${CEO}` }, 'laras', {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'write_file', arguments: { path: 'laras.txt', content: 'x' } },
    });
    expect(JSON.parse(reviewerWrite.body).result.isError).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'laras.txt'))).toBe(false);

    const evilOrigin = await call({ Authorization: `Bearer ${CEO}`, Origin: 'https://evil.example' }, 'laras', list);
    expect(evilOrigin.status).toBe(403);
  });

  it('executeTool menolak agentId yang tidak terdaftar untuk semua tool berbahaya', async () => {
    const { core, tmpDir } = await setup();
    for (const [tool, args] of [
      ['write_file', { path: 'x.txt', content: 'x' }],
      ['run_command', { command: 'node', args: ['-v'] }],
      ['security_scan', { scope: 'all' }],
      ['send_message', { to: 'ceo', text: 'halo' }],
    ] as const) {
      const res = await core.executeTool('bukan_agen', tool, args);
      expect(res.ok).toBe(false);
      expect(res.output).toContain('tidak terdaftar');
    }
    expect(fs.existsSync(path.join(tmpDir, 'x.txt'))).toBe(false);
  });
});
