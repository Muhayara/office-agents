/**
 * Sumber keadaan dunia untuk panggung 3D (F2).
 *
 * - `LocalWorldFeed`: `WorldSim` berjalan di peramban (demo statis / server mati), label SIMULASI.
 * - `NetWorldFeed`: dunia bersama dari sutradara di server lewat `/ws/world`. Snapshot 10 Hz
 *   diinterpolasi 200 ms di belakang jam server (jam disinkronkan lewat ping), jadi semua penonton
 *   melihat agen yang sama pada saat yang sama.
 */
import {
  WorldSim, decodeAgent, decodeRigs, parseWorldMsg,
  type AgentFrame, type DecodedAgent, type WorldAgentInfo, type WorldProps, type WorldServerMsg,
} from '@office/world';

export interface RigView { pull: number; swivel: number }

export interface WorldView {
  /** Jam dunia (dtk), naik monoton. */
  time: number;
  live: boolean;
  agents: AgentFrame[];
  rigs: RigView[];
  props: WorldProps;
}

export type FeedStatus = 'connecting' | 'open' | 'closed';

export interface WorldFeed {
  readonly kind: 'local' | 'net';
  /** Simulasi lokal (hanya `local`): hook debug memakai ini. */
  readonly sim?: WorldSim;
  /** Dipanggil sekali per frame render. */
  sample(dt: number): WorldView | null;
  status(): FeedStatus;
  /** Selisih jam server − jam lokal (ms), hanya `net`. */
  clockOffsetMs(): number;
  /** Perkiraan jam server sekarang (ms epoch), hanya `net` (null untuk lokal). */
  serverNowMs(): number | null;
  /** Uji: keadaan pada jam server tertentu tanpa mengubah buffer (lokal: keadaan sekarang). */
  peek(atServerMs?: number): WorldView | null;
  dispose(): void;
}

const EMPTY_PROPS: WorldProps = { meeting: null, workshop: null, pods: [false, false], focus: [false, false], onAir: false, liftCalled: false };

export class LocalWorldFeed implements WorldFeed {
  readonly kind = 'local' as const;
  readonly sim: WorldSim;
  constructor(agents: WorldAgentInfo[], seed = (Math.random() * 2 ** 32) >>> 0) {
    this.sim = new WorldSim({ agents, seed, live: false });
  }
  sample(dt: number): WorldView {
    this.sim.step(Math.min(dt, 0.1));
    const f = this.sim.frame();
    return { time: f.time, live: false, agents: f.agents, rigs: f.rigs.map((r) => ({ pull: r.pull, swivel: r.swivelAngle })), props: f.props };
  }
  status(): FeedStatus { return 'open'; }
  clockOffsetMs() { return 0; }
  serverNowMs() { return null; }
  peek(): WorldView {
    const f = this.sim.frame();
    return { time: f.time, live: false, agents: f.agents, rigs: f.rigs.map((r) => ({ pull: r.pull, swivel: r.swivelAngle })), props: f.props };
  }
  dispose() {}
}

interface Sample extends DecodedAgent { time: number }

/** Jeda interpolasi di belakang jam server (> 1 interval kirim 100 ms + jitter). */
export const INTERP_DELAY_MS = 200;

const lerpAngle = (a: number, b: number, k: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
};

export class NetWorldFeed implements WorldFeed {
  readonly kind = 'net' as const;
  private ws: WebSocket | null = null;
  private st: FeedStatus = 'connecting';
  private disposed = false;
  private retryMs = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private pingsSent = 0;
  private offset = 0;
  private haveRtt = false;
  private readonly rttSamples: Array<{ rtt: number; est: number }> = [];
  private t0 = 0;
  private live = true;
  private ids: string[] = [];
  private buffers: Sample[][] = [];
  private rigBuf: Array<{ time: number; rigs: RigView[] }> = [];
  private propsBuf: Array<{ time: number; props: WorldProps }> = [];
  private bubbleQ: Array<{ time: number; idx: number; text: string; dur: number }> = [];
  private bubbles: Array<{ text: string; until: number } | null> = [];
  private ready = false;

  constructor(private readonly url: string, private readonly onStatus?: (s: FeedStatus) => void) {
    this.connect();
  }

  private setStatus(s: FeedStatus) {
    this.st = s;
    this.onStatus?.(s);
  }

  private connect() {
    if (this.disposed) return;
    this.setStatus('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onmessage = (ev) => {
      let raw: unknown;
      try { raw = JSON.parse(String(ev.data)); } catch { return; }
      const msg = parseWorldMsg(raw);
      if (msg) this.onMessage(msg);
    };
    ws.onopen = () => {
      this.retryMs = 1000;
      this.pingsSent = 0;
      this.ping();
      clearInterval(this.pingTimer);
      // 5 ping pertama tiap 2 dtk (sinkron cepat), lalu tiap 10 dtk.
      this.pingTimer = setInterval(() => {
        if (this.pingsSent < 5 || this.pingsSent % 5 === 0) this.ping();
        else this.pingsSent++;
      }, 2000);
    };
    ws.onclose = () => {
      clearInterval(this.pingTimer);
      this.ws = null;
      this.ready = false;
      if (this.disposed) return;
      this.setStatus('closed');
      this.retryTimer = setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 8000);
    };
  }

  private ping() {
    this.pingsSent++;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'ping', c: performance.now() }));
  }

  private onMessage(msg: WorldServerMsg) {
    const nowLocal = performance.now();
    if (msg.t === 'pong') {
      const rtt = nowLocal - msg.c;
      if (rtt < 0 || rtt > 10_000) return;
      this.rttSamples.push({ rtt, est: msg.s + rtt / 2 - nowLocal });
      if (this.rttSamples.length > 8) this.rttSamples.shift();
      this.offset = this.rttSamples.reduce((a, b) => (b.rtt < a.rtt ? b : a)).est;
      this.haveRtt = true;
      return;
    }
    if (msg.t === 'hello') {
      if (!this.haveRtt) this.offset = msg.now - nowLocal;
      this.t0 = msg.now;
      this.live = msg.live;
      this.ids = msg.agents.map((a) => a.id);
      this.buffers = this.ids.map(() => []);
      this.bubbles = this.ids.map(() => null);
      this.bubbleQ = [];
      for (const r of msg.a) { const d = decodeAgent(r); this.buffers[d.idx]?.push({ ...d, time: msg.now }); }
      this.rigBuf = [{ time: msg.now, rigs: decodeRigs(msg.r) }];
      this.propsBuf = [{ time: msg.now, props: msg.p }];
      for (const b of msg.b) this.bubbleQ.push({ time: msg.now, idx: b[0], text: b[1], dur: b[2] / 10 });
      this.ready = true;
      this.setStatus('open');
      return;
    }
    if (!this.ready) return;
    for (const r of msg.a ?? []) {
      const d = decodeAgent(r);
      const buf = this.buffers[d.idx];
      if (!buf) continue;
      const last = buf[buf.length - 1];
      if (d.snap) buf.length = 0;
      // Agen yang lama diam lalu bergerak: anggap diam sampai tepat sebelum sampel baru.
      else if (last && msg.now - last.time > 150) buf.push({ ...last, time: msg.now - 100, t: last.t + (msg.now - 100 - last.time) / 1000 });
      buf.push({ ...d, time: msg.now });
      if (buf.length > 40) buf.splice(0, buf.length - 40);
    }
    if (msg.r) {
      const last = this.rigBuf[this.rigBuf.length - 1];
      if (last && msg.now - last.time > 150) this.rigBuf.push({ time: msg.now - 100, rigs: last.rigs });
      this.rigBuf.push({ time: msg.now, rigs: decodeRigs(msg.r) });
      if (this.rigBuf.length > 40) this.rigBuf.splice(0, this.rigBuf.length - 40);
    }
    if (msg.p) {
      this.propsBuf.push({ time: msg.now, props: msg.p });
      if (this.propsBuf.length > 20) this.propsBuf.splice(0, this.propsBuf.length - 20);
    }
    for (const b of msg.b ?? []) this.bubbleQ.push({ time: msg.now, idx: b[0], text: b[1], dur: b[2] / 10 });
  }

  sample(): WorldView | null {
    if (!this.ready) return null;
    return this.compute(performance.now() + this.offset - INTERP_DELAY_MS, true);
  }

  peek(atServerMs?: number): WorldView | null {
    if (!this.ready) return null;
    return this.compute(atServerMs ?? performance.now() + this.offset - INTERP_DELAY_MS, false);
  }

  serverNowMs() { return performance.now() + this.offset; }

  /** Interpolasi pada jam server `rt`. `mutate` = buang sampel lama & terapkan bubble (render). */
  private compute(rt: number, mutate: boolean): WorldView {
    for (let i = 0; mutate && i < this.bubbleQ.length;) {
      const q = this.bubbleQ[i]!;
      if (q.time <= rt) {
        this.bubbles[q.idx] = { text: q.text, until: q.time + q.dur * 1000 };
        this.bubbleQ.splice(i, 1);
      } else i++;
    }
    const agents: AgentFrame[] = [];
    this.buffers.forEach((buf, idx) => {
      if (buf.length === 0) return;
      let j = 0;
      while (j + 1 < buf.length && buf[j + 1]!.time <= rt) j++;
      if (mutate && j > 0) { buf.splice(0, j); j = 0; }
      const s0 = buf[j]!, s1 = buf[j + 1];
      let k = 0;
      if (s1 && s1.time > s0.time && rt > s0.time) k = Math.min(1, (rt - s0.time) / (s1.time - s0.time));
      const lerp = (a: number, b: number) => a + (b - a) * k;
      const b = this.bubbles[idx];
      const bubbleT = b ? (b.until - rt) / 1000 : 0;
      agents.push({
        id: this.ids[idx]!,
        x: s1 ? lerp(s0.x, s1.x) : s0.x,
        y: s1 ? lerp(s0.y, s1.y) : s0.y,
        z: s1 ? lerp(s0.z, s1.z) : s0.z,
        rotY: s1 ? lerpAngle(s0.rotY, s1.rotY, k) : s0.rotY,
        k: s1 ? lerp(s0.k, s1.k) : s0.k,
        state: s0.state,
        t: s0.t + Math.max(0, rt - s0.time) / 1000,
        pose: s0.pose, cup: s0.cup, doc: s0.doc, vis: s0.vis, gateWait: s0.gateWait, hasDoc: s0.hasDoc,
        bubble: b && bubbleT > 0 ? b.text : null, bubbleT: Math.max(0, bubbleT), bubbleReal: false, bubbleSeq: 0,
        status: s0.status,
      });
    });
    let ri = 0;
    while (ri + 1 < this.rigBuf.length && this.rigBuf[ri + 1]!.time <= rt) ri++;
    if (mutate && ri > 0) { this.rigBuf.splice(0, ri); ri = 0; }
    const r0 = this.rigBuf[ri], r1 = this.rigBuf[ri + 1];
    let rigs: RigView[] = r0?.rigs ?? [];
    if (r0 && r1 && r1.time > r0.time && rt > r0.time) {
      const k = Math.min(1, (rt - r0.time) / (r1.time - r0.time));
      rigs = r0.rigs.map((a, i) => { const b = r1.rigs[i] ?? a; return { pull: a.pull + (b.pull - a.pull) * k, swivel: a.swivel + (b.swivel - a.swivel) * k }; });
    }
    let pi = 0;
    while (pi + 1 < this.propsBuf.length && this.propsBuf[pi + 1]!.time <= rt) pi++;
    if (mutate && pi > 0) { this.propsBuf.splice(0, pi); pi = 0; }
    return { time: (rt - this.t0) / 1000, live: this.live, agents, rigs, props: this.propsBuf[pi]?.props ?? EMPTY_PROPS };
  }

  status() { return this.st; }
  clockOffsetMs() { return this.offset; }

  dispose() {
    this.disposed = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
  }
}

export function worldUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws/world`;
}
