/**
 * Protokol kanal `/ws/world` (F2). Server otoritatif mengirim snapshot ringkas; peramban menginterpolasi.
 *
 * Server → klien:
 *   hello  : `{ t:'hello', v, now, live, agents, a, r, p, b }` — keadaan penuh saat tersambung
 *   frame  : `{ t:'f', now, a?, r?, p?, b? }` — hanya yang berubah (10 Hz)
 *   pong   : `{ t:'pong', c, s }` — sinkronisasi jam (NTP sederhana)
 * Klien → server: `{ t:'ping', c }` saja.
 *
 * Baris agen `a`: [idx, x·100, y·100, z·100, rotY·1000, state, t·10, k·100, flags, pose, status]
 * flags: 1 cangkir, 2 dokumen, 4 terlihat, 8 menunggu pintu, 16 membawa dokumen, 32 lompat (tanpa interpolasi).
 * Bubble `b`: [idx, teks, sisa·10] — teks asli (`agent.say`, pesan, topik rapat) disamarkan untuk publik (K9).
 */
import { AGENT_STATUSES, type AgentStatus } from '@office/shared';
import { ANIM_STATES, ERRAND_POSES, type AgentFrame, type AnimState, type ErrandPose, type WorldAgentInfo, type WorldFrame, type WorldProps } from './sim';
import type { ChairRig } from './spots';

export const WORLD_PROTOCOL = 1;

export type WireAgentRow = [number, number, number, number, number, number, number, number, number, number, number];
export type WireBubble = [number, string, number];
export type Audience = 'full' | 'public';

export interface HelloMsg {
  t: 'hello';
  v: number;
  now: number;
  live: boolean;
  agents: WorldAgentInfo[];
  a: WireAgentRow[];
  r: number[];
  p: WorldProps;
  b: WireBubble[];
}
export interface FrameMsg {
  t: 'f';
  now: number;
  a?: WireAgentRow[];
  r?: number[];
  p?: WorldProps;
  b?: WireBubble[];
}
export interface PongMsg { t: 'pong'; c: number; s: number }
export type WorldServerMsg = HelloMsg | FrameMsg | PongMsg;

export const FLAG = { cup: 1, doc: 2, vis: 4, gate: 8, hasDoc: 16, snap: 32 } as const;

/** Baris pengganti untuk ucapan asli di kanal publik (dipilih deterministik). */
export const PUBLIC_REDACTED_LINES = [
  'Sedang mengerjakan tugas…',
  'Oke, segera kukerjakan.',
  'Hmm, coba kucek dulu.',
  'Catatan sudah kukirim.',
  'Sebentar, ada yang perlu dibahas.',
  'Lagi menyusun laporan.',
] as const;
export const PUBLIC_MEETING_TOPIC = 'Rapat tim';

const statusCode = (s: AgentStatus | null) => (s === null ? 0 : AGENT_STATUSES.indexOf(s) + 1);
const statusOfCode = (c: number): AgentStatus | null => (c <= 0 ? null : (AGENT_STATUSES[c - 1] ?? null));

export function encodeAgent(idx: number, f: AgentFrame, snap = false): WireAgentRow {
  const flags = (f.cup ? FLAG.cup : 0) | (f.doc ? FLAG.doc : 0) | (f.vis ? FLAG.vis : 0) | (f.gateWait ? FLAG.gate : 0)
    | (f.hasDoc ? FLAG.hasDoc : 0) | (snap ? FLAG.snap : 0);
  return [
    idx, Math.round(f.x * 100), Math.round(f.y * 100), Math.round(f.z * 100), Math.round(f.rotY * 1000),
    ANIM_STATES.indexOf(f.state), Math.round(f.t * 10), Math.round(f.k * 100), flags,
    f.pose ? ERRAND_POSES.indexOf(f.pose) + 1 : 0, statusCode(f.status),
  ];
}

export interface DecodedAgent {
  idx: number;
  x: number; y: number; z: number; rotY: number;
  state: AnimState;
  t: number;
  k: number;
  cup: boolean; doc: boolean; vis: boolean; gateWait: boolean; hasDoc: boolean; snap: boolean;
  pose: ErrandPose | null;
  status: AgentStatus | null;
}

export function decodeAgent(r: WireAgentRow): DecodedAgent {
  const flags = r[8];
  return {
    idx: r[0], x: r[1] / 100, y: r[2] / 100, z: r[3] / 100, rotY: r[4] / 1000,
    state: ANIM_STATES[r[5]] ?? 'working', t: r[6] / 10, k: r[7] / 100,
    cup: !!(flags & FLAG.cup), doc: !!(flags & FLAG.doc), vis: !!(flags & FLAG.vis), gateWait: !!(flags & FLAG.gate),
    hasDoc: !!(flags & FLAG.hasDoc), snap: !!(flags & FLAG.snap),
    pose: r[9] > 0 ? (ERRAND_POSES[r[9] - 1] ?? null) : null,
    status: statusOfCode(r[10]),
  };
}

export const encodeRigs = (rigs: ChairRig[]) => rigs.flatMap((r) => [Math.round(r.pull * 1000), Math.round(r.swivelAngle * 1000)]);
export function decodeRigs(flat: number[]): Array<{ pull: number; swivel: number }> {
  const out: Array<{ pull: number; swivel: number }> = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ pull: flat[i]! / 1000, swivel: flat[i + 1]! / 1000 });
  return out;
}

export function filterProps(p: WorldProps, aud: Audience): WorldProps {
  if (aud === 'full' || !p.meeting || !p.meeting.topicReal) return p;
  return { ...p, meeting: { ...p.meeting, topic: PUBLIC_MEETING_TOPIC, topicReal: false } };
}

function bubbleFor(idx: number, f: AgentFrame, aud: Audience): WireBubble | null {
  if (!f.bubble || f.bubbleT <= 0) return null;
  const text = aud === 'public' && f.bubbleReal ? PUBLIC_REDACTED_LINES[(idx * 7 + f.bubbleSeq) % PUBLIC_REDACTED_LINES.length]! : f.bubble;
  return [idx, text, Math.round(f.bubbleT * 10)];
}

/** Bandingkan baris tanpa kolom waktu-dalam-state (klien mengekstrapolasinya). */
const rowKey = (r: WireAgentRow) => `${r[1]},${r[2]},${r[3]},${r[4]},${r[5]},${r[7]},${r[8]},${r[9]},${r[10]}`;

/**
 * Encoder sisi server: satu per kanal dunia. `hello()` untuk klien baru, `tick()` sekali per kirim
 * (mengembalikan pesan per audiens, atau null bila tidak ada yang berubah).
 */
export class WorldEncoder {
  private lastRows: string[] = [];
  private lastPos: Array<{ x: number; z: number; vis: boolean } | undefined> = [];
  private lastBubbleSeq: number[] = [];
  private lastRigs = '';
  private lastProps: Record<Audience, string> = { full: '', public: '' };

  constructor(private readonly agents: WorldAgentInfo[]) {}

  hello(frame: WorldFrame, now: number, aud: Audience): HelloMsg {
    return {
      t: 'hello', v: WORLD_PROTOCOL, now, live: frame.live, agents: this.agents,
      a: frame.agents.map((f, i) => encodeAgent(i, f)),
      r: encodeRigs(frame.rigs),
      p: filterProps(frame.props, aud),
      b: frame.agents.map((f, i) => bubbleFor(i, f, aud)).filter((b): b is WireBubble => b !== null),
    };
  }

  tick(frame: WorldFrame, now: number): Record<Audience, string | null> {
    const rows: WireAgentRow[] = [];
    const bubbles: Record<Audience, WireBubble[]> = { full: [], public: [] };
    frame.agents.forEach((f, i) => {
      const prev = this.lastPos[i];
      const snap = !!prev && (prev.vis !== f.vis || Math.hypot(prev.x - f.x, prev.z - f.z) > 1.0);
      const row = encodeAgent(i, f, snap);
      const key = rowKey(row);
      if (key !== this.lastRows[i]) {
        this.lastRows[i] = key;
        rows.push(row);
      }
      this.lastPos[i] = { x: f.x, z: f.z, vis: f.vis };
      if (f.bubbleSeq !== this.lastBubbleSeq[i]) {
        this.lastBubbleSeq[i] = f.bubbleSeq;
        for (const aud of ['full', 'public'] as const) {
          const b = bubbleFor(i, f, aud);
          if (b) bubbles[aud].push(b);
        }
      }
    });
    const rigs = encodeRigs(frame.rigs);
    const rigKey = rigs.join(',');
    const rigsChanged = rigKey !== this.lastRigs;
    this.lastRigs = rigKey;
    const out: Record<Audience, string | null> = { full: null, public: null };
    for (const aud of ['full', 'public'] as const) {
      const props = filterProps(frame.props, aud);
      const pk = JSON.stringify(props);
      const propsChanged = pk !== this.lastProps[aud];
      this.lastProps[aud] = pk;
      if (rows.length === 0 && !rigsChanged && !propsChanged && bubbles[aud].length === 0) continue;
      const msg: FrameMsg = { t: 'f', now };
      if (rows.length > 0) msg.a = rows;
      if (rigsChanged) msg.r = rigs;
      if (propsChanged) msg.p = props;
      if (bubbles[aud].length > 0) msg.b = bubbles[aud];
      out[aud] = JSON.stringify(msg);
    }
    return out;
  }
}

/** Validasi ringan pesan server di klien (bentuk saja; isi dari server sendiri). */
export function parseWorldMsg(raw: unknown): WorldServerMsg | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as { t?: unknown; now?: unknown };
  if (m.t === 'hello' || m.t === 'f') return typeof m.now === 'number' ? (raw as WorldServerMsg) : null;
  if (m.t === 'pong') return raw as PongMsg;
  return null;
}
