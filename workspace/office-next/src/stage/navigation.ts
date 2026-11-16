/**
 * Navigasi gedung modular.
 *
 * Setiap ruangan punya navigasi LOKAL (koordinat relatif pusat ruangannya) dan portal pintu.
 * Router gedung menyambung ruangan lewat konektor (portal ↔ portal), jadi memindahkan
 * sebuah ruangan cukup dengan menggeser grup scene-nya: graf ikut berpindah.
 *
 * Waypoint boleh membawa `gate`: agen harus mendapat slot pintu (door mutex) sebelum
 * melanjutkan dari titik itu.
 */
import { AGENT_3D_POSITIONS, BOARDROOM, CORRIDOR_EAST, type DeskSpot, type Pt } from './layout';

export type NavPt = Pt & { gate?: string };

export function segLen(a: Pt, b: Pt) {
  const dx = b.x - a.x, dz = b.z - a.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function pathLength(path: Pt[]) {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += segLen(path[i - 1]!, path[i]!);
  return len;
}

/** Hapus titik berurutan yang hampir sama; gate dari titik yang dibuang dipindah ke titik yang tersisa. */
function dedupe(pts: NavPt[]): NavPt[] {
  const out: NavPt[] = [];
  for (const pt of pts) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(pt.x - prev.x) <= 0.06 && Math.abs(pt.z - prev.z) <= 0.06) {
      if (pt.gate && !prev.gate) prev.gate = pt.gate;
      continue;
    }
    out.push({ ...pt });
  }
  return out;
}

// ============================================================================
// Room_MainWorkspace — jaringan koridor (perilaku sama dengan versi sebelumnya)
// ============================================================================
/**
 * Jaringan jalan ruang kerja:
 * - Lorong Utara (North Aisle): Z = -3.4 (di antara meja Raka/Fajar dan meja pod)
 * - Lorong Tengah (Central Avenue): X = 0.0 (menghubungkan Utara ke Selatan)
 * - Promenade Selatan: Z = 0.8 (di depan pod menuju pantry, meja diskusi & pintu timur)
 * - Garis antrean kopi: X = -3.8 dan koridor tempat sampah: X = -5.0
 *
 * Setiap titik punya "jalan keluar" ke jaringan; rute = keluar -> koridor -> masuk.
 */
const NORTH_AISLE_Z = -3.4;
const PROMENADE_Z = 0.8;
const AVENUE_X = 0.0;
/** Meja eksekutif di dinding utara (Raka & Fajar). */
const EXEC_DESKS: Pt[] = Object.values(AGENT_3D_POSITIONS)
  .filter((p) => p.z < -3.0)
  .map((p) => ({ x: p.x, z: p.z }));

function mainToNetwork(p: Pt): Pt[] {
  // Antrean / mesin kopi: mundur lurus di garis antrean ke promenade
  if (p.z > 1.6 && Math.abs(p.x - -3.8) < 0.6) return [{ x: -3.8, z: PROMENADE_Z }];
  // Tempat sampah: lewat koridor X = -5.0 agar tidak menabrak bar kopi
  if (p.x <= -4.5 && p.z >= 3.0) return [{ x: -5.0, z: PROMENADE_Z }];
  // Kursi eksekutif di depan dinding utara: keluar lewat celah samping meja (tidak menembus meja).
  // Celah dihitung dari posisi meja, bukan dari posisi agen, agar titik di celah itu sendiri
  // tidak terus "digeser" ke timur.
  if (p.z < -4.0) {
    const desk = EXEC_DESKS.reduce((best, d) => (Math.abs(d.x - p.x) < Math.abs(best.x - p.x) ? d : best), EXEC_DESKS[0]!);
    const gapX = desk.x + 0.95;
    return [{ x: gapX, z: p.z }, { x: gapX, z: NORTH_AISLE_Z }];
  }
  // Sudah berada di Lorong Tengah (mis. dipanggil balik di tengah jalan)
  if (Math.abs(p.x - AVENUE_X) < 0.4) return [];
  // Baris belakang pod & depan meja eksekutif: mundur ke Lorong Utara
  if (p.z < -1.5) return [{ x: p.x, z: NORTH_AISLE_Z }];
  // Baris depan pod, area diskusi, sisi selatan, dan pintu timur: ke promenade
  return [{ x: p.x, z: PROMENADE_Z }];
}

function mainViaCorridor(a: Pt, b: Pt): Pt[] {
  const sameZ = Math.abs(a.z - b.z) < 0.05;
  if (sameZ) return [];
  return [{ x: AVENUE_X, z: a.z }, { x: AVENUE_X, z: b.z }];
}

export function mainRoomPath(from: Pt, to: Pt): NavPt[] {
  const exit = mainToNetwork(from);
  const entry = mainToNetwork(to).reverse();
  const a = exit[exit.length - 1] ?? from;
  const b = entry[0] ?? to;
  return dedupe([{ ...from }, ...exit, ...mainViaCorridor(a, b), ...entry, { ...to }]);
}

/** Titik berdiri tamu di samping/depan meja rekan (selalu di koridor yang bisa dicapai). */
export function visitSpotFor(p: DeskSpot): Pt {
  if (p.z < -3.0) return { x: p.x, z: -3.15 };                // depan meja eksekutif (Raka/Fajar)
  if (p.z < -1.5) return { x: p.x + 0.55, z: NORTH_AISLE_Z };  // belakang kursi baris belakang pod
  return { x: p.x + 0.55, z: 0.15 };                           // belakang kursi baris depan pod
}

// ============================================================================
// Corridor_East_Connector — lurus di sumbu tengah koridor
// ============================================================================
export function corridorPath(from: Pt, to: Pt): NavPt[] {
  return dedupe([{ ...from }, { x: from.x, z: 0 }, { x: to.x, z: 0 }, { ...to }]);
}

// ============================================================================
// Room_Boardroom_10p — promenade selatan, lorong utara, lorong barat (zona presenter)
// ============================================================================
type Lane = 'N' | 'S' | 'W';

function boardroomLane(p: Pt): { pts: Pt[]; lane: Lane } {
  const { south, north, west } = BOARDROOM.lanes;
  if (Math.abs(p.x - west) < 0.35 && p.z < south && p.z > north) return { pts: [], lane: 'W' };
  if (p.z < BOARDROOM.tableCenter.z) return { pts: [{ x: p.x, z: north }], lane: 'N' };
  return { pts: [{ x: p.x, z: south }], lane: 'S' };
}

export function boardroomPath(from: Pt, to: Pt): NavPt[] {
  const ea = boardroomLane(from);
  const eb = boardroomLane(to);
  const a = ea.pts[ea.pts.length - 1] ?? from;
  const b = eb.pts[0] ?? to;
  const west = BOARDROOM.lanes.west;
  const middle = ea.lane === eb.lane && ea.lane !== 'W'
    ? []
    : [{ x: west, z: a.z }, { x: west, z: b.z }];
  return dedupe([{ ...from }, ...ea.pts, ...middle, ...[...eb.pts].reverse(), { ...to }]);
}

// ============================================================================
// Router gedung
// ============================================================================
export interface NavRoom {
  id: string;
  /** Batas lokal ruangan (inklusif). */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  pathLocal: (from: Pt, to: Pt) => NavPt[];
  toWorld: (p: Pt) => Pt;
  toLocal: (p: Pt) => Pt;
}

export interface NavConnector {
  id: string;
  a: { room: string; portal: Pt };
  b: { room: string; portal: Pt };
  /** Gate yang dipasang di portal keberangkatan (kedua arah). */
  gate?: string;
}

export interface BuildingNav {
  path: (fromWorld: Pt, toWorld: Pt) => NavPt[];
  roomAt: (world: Pt) => string;
}

export function createBuildingNav(rooms: NavRoom[], connectors: NavConnector[]): BuildingNav {
  const byId = new Map(rooms.map((r) => [r.id, r]));

  const contains = (room: NavRoom, world: Pt) => {
    const p = room.toLocal(world);
    const { minX, maxX, minZ, maxZ } = room.bounds;
    return p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ;
  };

  /** Ruangan berurutan sesuai daftar; titik di luar semua ruangan masuk ruangan terdekat. */
  const roomAt = (world: Pt): string => {
    for (const r of rooms) if (contains(r, world)) return r.id;
    let best = rooms[0]!;
    let bestD = Infinity;
    for (const r of rooms) {
      const p = r.toLocal(world);
      const { minX, maxX, minZ, maxZ } = r.bounds;
      const dx = Math.max(minX - p.x, 0, p.x - maxX);
      const dz = Math.max(minZ - p.z, 0, p.z - maxZ);
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = r; }
    }
    return best.id;
  };

  /** BFS urutan konektor dari ruangan A ke B. */
  const hops = (from: string, to: string): Array<{ c: NavConnector; fromRoom: string; toRoom: string }> => {
    const prev = new Map<string, { c: NavConnector; fromRoom: string }>();
    const queue = [from];
    const seen = new Set([from]);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur === to) break;
      for (const c of connectors) {
        const next = c.a.room === cur ? c.b.room : c.b.room === cur ? c.a.room : null;
        if (!next || seen.has(next)) continue;
        seen.add(next);
        prev.set(next, { c, fromRoom: cur });
        queue.push(next);
      }
    }
    const out: Array<{ c: NavConnector; fromRoom: string; toRoom: string }> = [];
    let cur = to;
    while (cur !== from) {
      const p = prev.get(cur);
      if (!p) return [];
      out.unshift({ c: p.c, fromRoom: p.fromRoom, toRoom: cur });
      cur = p.fromRoom;
    }
    return out;
  };

  const legWorld = (room: NavRoom, fromWorld: Pt, toWorld: Pt): NavPt[] =>
    room.pathLocal(room.toLocal(fromWorld), room.toLocal(toWorld)).map((p) => ({ ...room.toWorld(p), gate: p.gate }));

  const path = (fromWorld: Pt, toWorld: Pt): NavPt[] => {
    const ra = roomAt(fromWorld);
    const rb = roomAt(toWorld);
    if (ra === rb) {
      return dedupe([{ ...fromWorld }, ...legWorld(byId.get(ra)!, fromWorld, toWorld).slice(1, -1), { ...toWorld }]);
    }
    const route = hops(ra, rb);
    if (route.length === 0) return [{ ...fromWorld }, { ...toWorld }];

    const pts: NavPt[] = [{ ...fromWorld }];
    let cur = fromWorld;
    for (const hop of route) {
      const room = byId.get(hop.fromRoom)!;
      const next = byId.get(hop.toRoom)!;
      const exitSide = hop.c.a.room === hop.fromRoom ? hop.c.a : hop.c.b;
      const entrySide = hop.c.a.room === hop.fromRoom ? hop.c.b : hop.c.a;
      const exitWorld = room.toWorld(exitSide.portal);
      const leg = legWorld(room, cur, exitWorld).slice(1);
      const last = leg[leg.length - 1];
      if (last && hop.c.gate) last.gate = hop.c.gate;
      pts.push(...leg);
      const entryWorld = next.toWorld(entrySide.portal);
      pts.push({ ...entryWorld });
      cur = entryWorld;
    }
    const lastRoom = byId.get(rb)!;
    pts.push(...legWorld(lastRoom, cur, toWorld).slice(1, -1), { ...toWorld });
    return dedupe(pts);
  };

  return { path, roomAt };
}

/** Konstanta portal (lokal masing-masing ruangan) untuk konektor gedung lantai 1. */
export const FLOOR1_PORTALS = {
  mainEast: { x: 6.0, z: 2.35 },
  corridorWest: { x: -CORRIDOR_EAST.halfLength, z: 0 },
  corridorEastQueue: CORRIDOR_EAST.doorQueue,
  boardroomDoorInside: BOARDROOM.doorInside,
} as const;

export const BOARDROOM_DOOR_GATE = 'boardroom_door';
