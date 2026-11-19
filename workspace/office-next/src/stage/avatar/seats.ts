import { AGENT_3D_POSITIONS, MANAGER, type AgentFrame, type Floor1Spots } from '@office/world';
import type { FootTarget } from './poses';

/**
 * F1 — kalibrasi 50 dudukan (rencana §3.2, ledger §10.5). `sitY` v1 adalah tinggi titik asal avatar v1,
 * bukan tinggi dudukan; Rig v2 memakai permukaan dudukan NYATA hasil raycast ke GLB (19 Nov):
 *
 * | Jenis | Jumlah | Permukaan | Tepi meja/meja bar di depan titik |
 * | desk (kursi kerja) | 9 | 0,450 | 0,20 m, meja 0,75 m, keyboard 0,45 m |
 * | exec (Raka) | 1 | 0,473 | 0,15 m |
 * | board | 10 | 0,455 | 0,45 m (kursi terselip) |
 * | stool | 4 | 0,734 | 0,35 m, meja bar 1,05 m; TANPA cincin pijakan |
 * | sofa | 3 | 0,440 | — |
 * | commons | 6 | 0,450 | 0,35 m |
 * | garden (bangku teak) | 3 | 0,450 | — |
 * | workshop | 6 | 0,450 | 0,25 m |
 * | pod (diner) | 4 | 0,450 | 0,40 m, meja 0,72 m |
 * | focus | 2 | 0,450 | 0,30 m |
 * | studio (editor) | 1 | 0,450 | 0,40 m |
 * | server (konsol) | 1 | 0,450 | 0,25 m |
 *
 * Semua jarak di sepanjang arah hadap dari titik dudukan @office/world (`fwd`), tinggi dari lantai.
 */
export type SeatKind = 'desk' | 'exec' | 'board' | 'stool' | 'sofa' | 'commons' | 'garden' | 'workshop' | 'pod' | 'focus' | 'studio' | 'server';

export interface SeatCalib {
  kind: SeatKind;
  /** Permukaan dudukan (m). */
  top: number;
  /** Sendi pinggul di depan titik dudukan (m). */
  hipFwd: number;
  /** Condong badan (rad, + ke depan; − bersandar). */
  lean: number;
  /** Target pergelangan kaki (sol + 0,07 m). `lat` = jarak ke samping dari garis tengah. */
  footL: FootTarget;
  footR: FootTarget;
  /** Permukaan kerja untuk tangan (keyboard / meja) atau null (tangan di paha). */
  work: { fwd: number; y: number } | null;
  /** Tunduk kepala ke layar / meja (rad). */
  screenPitch: number;
}

const foot = (fwd: number, lat = 0.13, y = 0.07): FootTarget => ({ fwd, y, lat });
const seat = (kind: SeatKind, top: number, hipFwd: number, lean: number, fwd: number, work: SeatCalib['work'], screenPitch: number, lat = 0.13): SeatCalib =>
  ({ kind, top, hipFwd, lean, footL: foot(fwd, lat), footR: foot(fwd, lat), work, screenPitch });

const EXEC_DY = MANAGER.deskTopY - 0.754;

export const SEAT_CALIB: Record<SeatKind, SeatCalib> = {
  desk: seat('desk', 0.45, 0.0, 0.1, 0.42, { fwd: 0.37, y: 0.795 }, 0.36),
  exec: seat('exec', 0.473, -0.02, 0.08, 0.4, { fwd: 0.37, y: 0.795 + EXEC_DY }, 0.36),
  board: seat('board', 0.455, 0.02, 0.08, 0.4, { fwd: 0.47, y: 0.775 }, 0.12),
  // Stool (keputusan CEO 19 Nov): kaki kiri menapak lantai, kaki kanan di kaki stool (0,28 m, diagonal depan-kanan).
  // Kaki stool: permukaan atas 0,28 m pada r 0,28 m di diagonal 45° → sol kanan di (0,198 depan, 0,198 samping), 0,30 m.
  stool: { kind: 'stool', top: 0.734, hipFwd: 0.0, lean: 0.06, footL: foot(0.24, 0.08), footR: { fwd: 0.148, y: 0.37, lat: 0.198 }, work: { fwd: 0.45, y: 1.075 }, screenPitch: 0.15 },
  sofa: seat('sofa', 0.44, 0.0, -0.2, 0.55, null, 0.05, 0.15),
  commons: seat('commons', 0.45, 0.0, 0.06, 0.42, { fwd: 0.46, y: 0.77 }, 0.22),
  // Kerikil + batu pijakan Garden 2,4 cm di atas lantai.
  garden: { ...seat('garden', 0.45, 0.0, 0.08, 0.44, null, 0.08, 0.15), footL: foot(0.44, 0.15, 0.094), footR: foot(0.44, 0.15, 0.094) },
  workshop: seat('workshop', 0.45, -0.02, 0.05, 0.38, { fwd: 0.36, y: 0.77 }, 0.15),
  pod: seat('pod', 0.45, 0.0, 0.08, 0.42, { fwd: 0.45, y: 0.745 }, 0.15),
  focus: seat('focus', 0.45, 0.0, 0.1, 0.4, { fwd: 0.42, y: 0.77 }, 0.28),
  studio: seat('studio', 0.45, 0.03, 0.14, 0.42, { fwd: 0.5, y: 0.785 }, 0.2),
  server: seat('server', 0.45, 0.0, 0.1, 0.4, { fwd: 0.38, y: 0.785 }, 0.3),
};

/**
 * Koreksi per kursi sofa L (titik @office/world tidak di tengah bantalan):
 * kursi 0 jatuh di lereng sandaran (permukaan 0,55 m di titiknya), kursi 2 di dekat tepi depan bantalan dalam.
 */
const SOFA_HIP_FWD = [0.1, 0.0, -0.1] as const;

const ROOM_SEAT: Record<string, SeatKind> = {
  lounge: 'sofa', commons: 'commons', garden: 'garden', workshop: 'workshop', collabpods: 'pod',
  focus: 'focus', studio: 'studio', server: 'server',
};

/** Jenis dudukan dari keadaan dunia (null = tidak duduk di mana pun). */
export function seatKindFor(f: AgentFrame, room: string): SeatKind | null {
  switch (f.state) {
    case 'working':
    case 'drinking':
    case 'meeting_called':
      return AGENT_3D_POSITIONS[f.id]?.style === 'executive' ? 'exec' : 'desk';
    case 'meeting_sitting':
    case 'in_meeting':
    case 'meeting_standing':
      return 'board';
    case 'sipping_at_bar':
      return 'stool';
    case 'errand_stay':
      return f.k > 0 ? ROOM_SEAT[room] ?? null : null;
    default:
      return null;
  }
}

/** Kalibrasi dudukan untuk agen di (x, z): termasuk koreksi per kursi sofa. */
export function seatCalibAt(kind: SeatKind, x: number, z: number, spots: Floor1Spots): SeatCalib {
  const base = SEAT_CALIB[kind];
  if (kind !== 'sofa') return base;
  let best = 0, bd = Infinity;
  spots.sofa.forEach((s, i) => {
    const d = Math.hypot(s.spot.x - x, s.spot.z - z);
    if (d < bd) { bd = d; best = i; }
  });
  return { ...base, hipFwd: SOFA_HIP_FWD[best] ?? 0 };
}

/** Daftar 50 dudukan (dunia) untuk matriks uji `seatCheck()`. */
export function allSeats(spots: Floor1Spots, desks: Array<{ id: string; x: number; z: number; rotY: number }>, board: Array<{ x: number; z: number; rotY: number }>) {
  const out: Array<{ kind: SeatKind; id: string; x: number; z: number; rotY: number }> = [];
  for (const d of desks) out.push({ kind: AGENT_3D_POSITIONS[d.id]?.style === 'executive' ? 'exec' : 'desk', ...d });
  board.forEach((b, i) => out.push({ kind: 'board', id: `board${i}`, ...b }));
  spots.stools.forEach((s, i) => out.push({ kind: 'stool', id: `stool${i}`, x: s.seat.x, z: s.seat.z, rotY: s.seat.rotY }));
  const list: Array<[SeatKind, Array<{ spot: { x: number; z: number; rotY: number } }>]> = [
    ['sofa', spots.sofa], ['commons', spots.commons], ['garden', spots.garden], ['workshop', spots.workshop],
    ['pod', spots.pods], ['focus', spots.focus], ['studio', [spots.studio.editor]], ['server', [spots.serverConsole]],
  ];
  for (const [kind, seats] of list) seats.forEach((s, i) => out.push({ kind, id: `${kind}${i}`, x: s.spot.x, z: s.spot.z, rotY: s.spot.rotY }));
  return out;
}
