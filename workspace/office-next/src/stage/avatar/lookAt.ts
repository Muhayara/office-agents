import * as THREE from 'three';
import { isWalking, type AgentFrame } from '@office/world';
import type { SeatCalib } from './seats';

/**
 * F1 — tolehan kepala (rencana §3.2). Prioritas target:
 * 1. lawan bicara yang sedang ber-bubble (obrolan, kunjungan meja, pods, Commons, rapat);
 * 2. presenter Workshop / TV Boardroom saat sesi rapat;
 * 3. arah jalan (kepala menoleh ke arah baru sebelum badan selesai berbelok — badan dibatasi 7 rad/dtk);
 * 4. layar/keyboard saat mengetik, dengan lirikan ke meja tetangga tiap ±11 dtk (deterministik dari
 *    waktu-dalam-state dunia, jadi sama di semua penonton);
 * 5. (F6) avatar tamu yang lewat.
 * Dibatasi yaw ±70°, pitch ±30°, diredam τ 0,25 dtk.
 */

export type LookTarget =
  | { kind: 'point'; p: THREE.Vector3 }
  | { kind: 'dir'; yaw: number; pitch: number };

export const LOOK_YAW_MAX = (70 * Math.PI) / 180;
export const LOOK_PITCH_MAX = (30 * Math.PI) / 180;
const LOOK_TAU = 0.25;

export class LookController {
  yaw = 0;
  pitch = 0;
  update(yaw: number, pitch: number, dt: number) {
    const ty = THREE.MathUtils.clamp(yaw, -LOOK_YAW_MAX, LOOK_YAW_MAX);
    const tp = THREE.MathUtils.clamp(pitch, -LOOK_PITCH_MAX, LOOK_PITCH_MAX);
    const a = 1 - Math.exp(-dt / LOOK_TAU);
    this.yaw += (ty - this.yaw) * a;
    this.pitch += (tp - this.pitch) * a;
  }
  snap(yaw = 0, pitch = 0) { this.yaw = yaw; this.pitch = pitch; }
}

export interface LookWorld {
  frames: readonly AgentFrame[];
  /** Posisi kepala dunia agen lain (frame sebelumnya), null bila tidak terlihat. */
  headOf(id: string, out: THREE.Vector3): THREE.Vector3 | null;
  roomOf(f: AgentFrame): string;
  meetingSession: boolean;
  tv: THREE.Vector3;
  workshopDisplay: THREE.Vector3;
}

const SOCIAL = new Set(['visiting', 'errand_stay', 'in_meeting', 'waiting_in_queue', 'sipping_at_bar', 'working', 'drinking', 'brewing', 'meeting_called']);
const hash = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Pilih target tatapan agen `f` (indeks `idx`). Titik dikembalikan di `out` (dipakai ulang).
 */
export function chooseLook(f: AgentFrame, idx: number, seat: SeatCalib | null, w: LookWorld, out: THREE.Vector3): LookTarget {
  const room = w.roomOf(f);
  // 3. Berjalan: arah hadap dunia (badan menyusul dengan laju terbatas).
  if (isWalking(f.state)) {
    return { kind: 'dir', yaw: NaN, pitch: f.gateWait ? 0.05 : 0.14 };
  }
  if (!SOCIAL.has(f.state)) return { kind: 'dir', yaw: 0, pitch: 0.06 };

  // 1. Lawan bicara: agen terdekat yang sedang bicara (atau bila diri sendiri bicara: rekan terdekat).
  const radius = f.state === 'in_meeting' ? 4.6 : room === 'workshop' ? 5 : 2.7;
  let best: AgentFrame | null = null, bd = Infinity;
  const selfTalk = f.bubbleT > 0;
  for (const o of w.frames) {
    if (o.id === f.id || !o.vis) continue;
    const d = Math.hypot(o.x - f.x, o.z - f.z);
    if (d > radius) continue;
    const talking = o.bubbleT > 0;
    if (!talking && !(selfTalk && d < 2.2 && SOCIAL.has(o.state))) continue;
    // Orang menatap wajah: pembicara yang membelakangi kita (menghadap TV / layar) tidak dijadikan target.
    if (d > 0.05 && (Math.sin(o.rotY) * (f.x - o.x) + Math.cos(o.rotY) * (f.z - o.z)) / d < -0.3) continue;
    const score = d - (talking ? 10 : 0);
    if (score < bd) { bd = score; best = o; }
  }
  if (best && w.headOf(best.id, out)) return { kind: 'point', p: out };

  // 2. Rapat / Workshop.
  if (f.state === 'in_meeting' && w.meetingSession) return { kind: 'point', p: out.copy(w.tv) };
  if (f.state === 'errand_stay' && room === 'workshop' && f.k > 0) {
    const pres = w.frames.find((o) => o.id !== f.id && o.vis && o.state === 'errand_stay' && o.pose === 'inspect' && w.roomOf(o) === 'workshop');
    if (pres && w.headOf(pres.id, out)) return { kind: 'point', p: out };
    return { kind: 'point', p: out.copy(w.workshopDisplay) };
  }

  // 4. Mengetik / bekerja di meja: layar + lirikan.
  const typing = f.state === 'working' || (f.state === 'errand_stay' && f.pose === 'type' && f.k >= 1);
  if (typing) {
    if (f.status === 'waiting_approval') return { kind: 'dir', yaw: 0.45 * Math.sin(f.t * 0.9), pitch: -0.12 };
    if (f.status === 'error') return { kind: 'dir', yaw: 0, pitch: (seat?.screenPitch ?? 0.3) * 0.6 };
    const slot = Math.floor((f.t + idx * 3.7) / 11);
    const ph = (f.t + idx * 3.7) / 11 - slot;
    const r = hash(idx, slot);
    const glance = r > 0.25 && ph > 0.55 && ph < 0.55 + 1.4 / 11;
    const side = hash(slot, idx) > 0.5 ? 1 : -1;
    return { kind: 'dir', yaw: glance ? side * 0.75 : 0.04 * Math.sin(f.t * 0.7 + idx), pitch: glance ? 0.05 : seat?.screenPitch ?? 0.3 };
  }
  if (f.state === 'errand_stay') {
    switch (f.pose) {
      case 'inspect': return { kind: 'dir', yaw: 0.22 * Math.sin(f.t * 0.5 + idx), pitch: -0.08 };
      case 'present': return { kind: 'dir', yaw: 0.12 * Math.sin(f.t * 0.6), pitch: 0 };
      case 'discuss': return { kind: 'dir', yaw: 0.3 * Math.sin(f.t * 0.35 + idx), pitch: 0.12 };
      default: return { kind: 'dir', yaw: 0.35 * Math.sin(f.t * 0.25 + idx), pitch: 0.02 };
    }
  }
  if (f.state === 'brewing') return { kind: 'dir', yaw: 0, pitch: 0.35 };
  return { kind: 'dir', yaw: 0.25 * Math.sin(f.t * 0.3 + idx), pitch: 0.06 };
}
