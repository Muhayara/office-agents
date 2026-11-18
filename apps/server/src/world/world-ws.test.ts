import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { parseOfficeConfig } from '@office/shared';
import { PUBLIC_REDACTED_LINES, decodeAgent, type FrameMsg, type HelloMsg } from '@office/world';
import { OfficeDb } from '../db';
import { OfficeCore } from '../core/office-core';
import { createOfficeHttpServer } from '../http-server';
import { SESSION_COOKIE_NAME, createSessionValue, loadAuthConfig } from '../security/auth';
import { WORLD_MAX_PER_IP, WorldDirector } from './world-director';

/** F2: kanal dunia bersama — publik menonton tanpa login, teks asli disamarkan, hanya ping diterima. */

const CEO = 'ceo-token-'.padEnd(40, 'x');
const servers: http.Server[] = [];
const sockets: WebSocket[] = [];
const directors: WorldDirector[] = [];
const dbs: OfficeDb[] = [];

afterEach(async () => {
  for (const s of sockets.splice(0)) s.terminate();
  for (const d of directors.splice(0)) d.stop();
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(() => r(null)))));
  for (const db of dbs.splice(0)) db.close();
});

async function setup() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-world-test-'));
  const config = parseOfficeConfig(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../office.config.json'), 'utf8')));
  const db = new OfficeDb(':memory:');
  dbs.push(db);
  const core = new OfficeCore({ config, db, workspaceDir: tmpDir });
  const auth = loadAuthConfig({ rootDir: tmpDir, env: { OFFICE_TOKEN: CEO }, ports: [5174] });
  let clock = 1_000_000;
  const director = new WorldDirector(core, { seed: 123, now: () => clock });
  directors.push(director);
  const { server } = createOfficeHttpServer({ core, scheduler: { checkGatewayHealth: async () => {} }, auth, workspaceDir: tmpDir, upgrades: { '/ws/world': director.handleUpgrade } });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;
  const advance = (ms: number) => { for (let t = 0; t < ms; t += 50) { clock += 50; director.tick(); } };
  return { core, auth, director, port, advance };
}

interface Conn { ws: WebSocket; msgs: unknown[]; status?: number; closeCode?: number }
function connect(port: number, headers: Record<string, string> = {}): Promise<Conn> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/world`, { headers });
    sockets.push(ws);
    const c: Conn = { ws, msgs: [] };
    ws.on('unexpected-response', (_q, res) => { c.status = res.statusCode; resolve(c); });
    ws.on('error', () => resolve(c));
    ws.on('close', (code) => { c.closeCode = code; });
    ws.on('message', (d) => {
      c.msgs.push(JSON.parse(d.toString()));
      if (c.msgs.length === 1) resolve(c);
    });
  });
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Kanal /ws/world (F2)', () => {
  it('publik tanpa login menerima hello dengan 10 agen; CEO & publik melihat posisi yang sama', async () => {
    const { port, advance, auth } = await setup();
    const pub = await connect(port);
    const ceo = await connect(port, { Cookie: `${SESSION_COOKIE_NAME}=${createSessionValue(auth, 'ceo')}` });
    const hello = pub.msgs[0] as HelloMsg;
    expect(hello.t).toBe('hello');
    expect(hello.live).toBe(true);
    expect(hello.agents).toHaveLength(10);
    advance(3000);
    await wait(80);
    const lastPos = (c: Conn) => {
      const pos = new Map<number, string>();
      for (const m of c.msgs as Array<HelloMsg | FrameMsg>) for (const r of m.a ?? []) { const d = decodeAgent(r); pos.set(d.idx, `${d.x},${d.z},${d.state}`); }
      return [...pos.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]).join('|');
    };
    expect(lastPos(pub)).toBe(lastPos(ceo));
  });

  it('ucapan asli hanya untuk sesi berhak; publik mendapat baris template', async () => {
    const { port, advance, auth, core } = await setup();
    const pub = await connect(port);
    const ceo = await connect(port, { Cookie: `${SESSION_COOKIE_NAME}=${createSessionValue(auth, 'ceo')}` });
    const at = new Date().toISOString();
    core.emit({ type: 'agent.say', agentId: 'bima', text: 'Kunci produksi ada di vault-7', emotion: 'neutral', at });
    advance(200);
    await wait(80);
    const texts = (c: Conn) => (c.msgs as Array<HelloMsg | FrameMsg>).flatMap((m) => (m.b ?? []).map((b) => b[1]));
    expect(texts(ceo).some((t) => t.includes('vault-7'))).toBe(true);
    expect(texts(pub).some((t) => t.includes('vault-7'))).toBe(false);
    expect(texts(pub).some((t) => (PUBLIC_REDACTED_LINES as readonly string[]).includes(t))).toBe(true);
  });

  it('hanya ping yang diterima (pong membawa jam server); pesan lain memutus koneksi', async () => {
    const { port } = await setup();
    const a = await connect(port);
    a.ws.send(JSON.stringify({ t: 'ping', c: 42 }));
    await wait(80);
    const pong = a.msgs.find((m) => (m as { t: string }).t === 'pong') as { c: number; s: number } | undefined;
    expect(pong?.c).toBe(42);
    expect(typeof pong?.s).toBe('number');
    a.ws.send(JSON.stringify({ type: 'office.pause', paused: true }));
    await wait(80);
    expect(a.closeCode).toBe(1008);
    const b = await connect(port);
    b.ws.send('x'.repeat(4096));
    await wait(80);
    expect(b.closeCode).toBe(1009);
  });

  it('batas koneksi per IP & Origin asing ditolak', async () => {
    const { port } = await setup();
    for (let i = 0; i < WORLD_MAX_PER_IP; i++) expect((await connect(port)).status).toBeUndefined();
    expect((await connect(port)).status).toBe(429);
    expect((await connect(port, { Origin: 'https://evil.example.com' })).status).toBe(403);
  });
});
