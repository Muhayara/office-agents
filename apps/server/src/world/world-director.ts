import type http from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { roleLabel, type ServerEvent } from '@office/shared';
import { WorldEncoder, WorldSim, worldEventsFrom, type Audience, type WorldAgentInfo } from '@office/world';
import type { OfficeCore } from '../core/office-core';
import { type Principal, seesRealSpeech } from '../security/auth';
import { clientKey } from '../http-util';

/**
 * Sutradara dunia bersama (F2, rencana-fpv-dan-kustomisasi-karakter.md §3.6, keputusan CEO 18 Nov):
 * satu `WorldSim` otoritatif di server, semua penonton menerima snapshot ringkas yang sama lewat
 * `/ws/world` dan menginterpolasi. Publik boleh menonton tanpa login (K2) dengan teks asli disamarkan (K9).
 */

export const WORLD_TICK_MS = 50;
export const WORLD_SEND_EVERY = 2;
export const WORLD_MAX_PER_IP = 6;
export const WORLD_MAX_TOTAL = 200;
/** Klien hanya boleh mengirim ping (≈ 40 byte). */
export const WORLD_MAX_PAYLOAD = 512;
const PING_MIN_GAP_MS = 400;

interface Viewer {
  ws: WebSocket;
  aud: Audience;
  ip: string;
  lastPing: number;
}

export class WorldDirector {
  readonly sim: WorldSim;
  private readonly encoder: WorldEncoder;
  private readonly agentIds: ReadonlySet<string>;
  private readonly wss = new WebSocketServer({
    noServer: true,
    maxPayload: WORLD_MAX_PAYLOAD,
    perMessageDeflate: { threshold: 256 },
  });
  private readonly viewers = new Set<Viewer>();
  private readonly now: () => number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickNo = 0;
  private lastStep = 0;
  private unsubscribe: (() => void) | null = null;

  constructor(
    core: Pick<OfficeCore, 'getSnapshot' | 'onEvent'>,
    opts: { seed?: number; now?: () => number } = {},
  ) {
    this.now = opts.now ?? Date.now;
    const snap = core.getSnapshot();
    const agents: WorldAgentInfo[] = snap.agents.map((a) => ({ id: a.id, name: a.name, title: a.title ?? roleLabel(a.role, 'id') }));
    this.agentIds = new Set(agents.map((a) => a.id));
    this.sim = new WorldSim({ agents, seed: opts.seed ?? (Math.random() * 2 ** 32) >>> 0, live: true });
    for (const a of snap.agents) this.sim.setStatus(a.id, a.status);
    const simIds = new Set(this.sim.agentIds());
    this.encoder = new WorldEncoder(agents.filter((a) => simIds.has(a.id)));
    this.lastStep = this.now();
    this.unsubscribe = core.onEvent((ev) => this.onServerEvent(ev));
  }

  onServerEvent(ev: ServerEvent) {
    if (ev.type === 'agent.status') {
      this.sim.setStatus(ev.agentId, ev.status);
      return;
    }
    for (const we of worldEventsFrom(ev, this.agentIds)) this.sim.handleEvent(we);
  }

  start() {
    if (this.timer) return;
    this.lastStep = this.now();
    this.timer = setInterval(() => this.tick(), WORLD_TICK_MS);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const v of this.viewers) v.ws.terminate();
    this.viewers.clear();
    this.wss.close();
  }

  /** Satu tick: majukan simulasi sesuai waktu nyata (maks 0,25 dtk sekaligus), kirim tiap 2 tick. */
  tick() {
    const now = this.now();
    let elapsed = Math.min(now - this.lastStep, 250);
    this.lastStep = now;
    while (elapsed > 0) {
      this.sim.step(Math.min(elapsed, WORLD_TICK_MS) / 1000);
      elapsed -= WORLD_TICK_MS;
    }
    this.tickNo += 1;
    if (this.tickNo % WORLD_SEND_EVERY === 0) this.broadcast(now);
  }

  private broadcast(now: number) {
    const out = this.encoder.tick(this.sim.frame(), now);
    for (const v of this.viewers) {
      const payload = out[v.aud];
      if (payload && v.ws.readyState === WebSocket.OPEN && v.ws.bufferedAmount < 256 * 1024) v.ws.send(payload);
    }
  }

  viewerCount() { return this.viewers.size; }

  /** Penangan upgrade `/ws/world` (Host/Origin sudah dicek http-server). Publik diizinkan (K2). */
  readonly handleUpgrade = (req: http.IncomingMessage, socket: Duplex, head: Buffer, principal: Principal | null): boolean => {
    const ip = clientKey(req);
    let perIp = 0;
    for (const v of this.viewers) if (v.ip === ip) perIp++;
    if (perIp >= WORLD_MAX_PER_IP || this.viewers.size >= WORLD_MAX_TOTAL) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
      return true;
    }
    const aud: Audience = seesRealSpeech(principal?.role) ? 'full' : 'public';
    this.wss.handleUpgrade(req, socket, head, (ws) => this.onConnection(ws, aud, ip));
    return true;
  };

  private onConnection(ws: WebSocket, aud: Audience, ip: string) {
    const viewer: Viewer = { ws, aud, ip, lastPing: 0 };
    this.viewers.add(viewer);
    ws.send(JSON.stringify(this.encoder.hello(this.sim.frame(), this.now(), aud)));
    ws.on('message', (data, isBinary) => {
      if (isBinary) { ws.close(1003, 'teks saja'); return; }
      let msg: unknown;
      try { msg = JSON.parse(data.toString()); } catch { ws.close(1007, 'JSON tidak valid'); return; }
      const m = msg as { t?: unknown; c?: unknown };
      if (m.t !== 'ping' || typeof m.c !== 'number' || !Number.isFinite(m.c)) { ws.close(1008, 'hanya ping'); return; }
      const now = this.now();
      if (now - viewer.lastPing < PING_MIN_GAP_MS) return;
      viewer.lastPing = now;
      ws.send(JSON.stringify({ t: 'pong', c: m.c, s: now }));
    });
    const drop = () => this.viewers.delete(viewer);
    ws.on('close', drop);
    ws.on('error', drop);
  }
}
