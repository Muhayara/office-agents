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
import {
  AGENT_3D_POSITIONS,
  BOARDROOM,
  CORRIDOR_BUS,
  LOBBY,
  LOUNGE,
  MANAGER,
  PANTRY,
  ROOM_FOYER,
  ROOM_LOBBY,
  ROOM_LOUNGE,
  ROOM_MAIN,
  ROOM_MANAGER,
  ROOM_PANTRY,
  ROOM_SERVER,
  SERVER,
  SOUTH_ROOM_DOOR_INSIDE_Z,
  type DeskSpot,
  type Pt,
} from './layout';

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
 * - Lorong Utara (North Aisle): Z = -3.4 (di antara meja eksekutif Fajar dan meja pod)
 * - Lorong Tengah (Central Avenue): X = 0.0 (menghubungkan Utara ke Selatan)
 * - Promenade Selatan: Z = 0.8 (di depan pod menuju meja diskusi & 2 pintu selatan)
 * - Pintu selatan (X = -3.5 & +3.5) dicapai lurus dari promenade.
 *
 * Setiap titik punya "jalan keluar" ke jaringan; rute = keluar -> koridor -> masuk.
 */
const NORTH_AISLE_Z = -3.4;
const PROMENADE_Z = 0.8;
const AVENUE_X = 0.0;
/** Meja di ruang kerja (Tahap 2: meja Raka pindah ke Ruang Manajer). */
const isMainDesk = (p: DeskSpot) => (p.room ?? 'main') === 'main';
/** Meja eksekutif di dinding utara ruang kerja (Fajar). */
const EXEC_DESKS: Pt[] = Object.values(AGENT_3D_POSITIONS)
  .filter((p) => isMainDesk(p) && p.z < -3.0)
  .map((p) => ({ x: p.x, z: p.z }));

function mainToNetwork(p: Pt): Pt[] {
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
  // Baris depan pod, area diskusi, tempat sampah, dan pintu selatan: lurus ke promenade
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

/**
 * Titik berdiri tamu di samping/depan meja rekan (selalu di koridor yang bisa dicapai),
 * LOKAL terhadap ruangan meja itu.
 */
export function visitSpotFor(p: DeskSpot): Pt {
  if (p.room === 'manager') return { ...MANAGER.visitSpot };    // depan meja Raka, menghadap Barat
  if (p.z < -3.0) return { x: p.x, z: -3.15 };                // depan meja eksekutif (Fajar)
  if (p.z < -1.5) return { x: p.x + 0.55, z: NORTH_AISLE_Z };  // belakang kursi baris belakang pod
  return { x: p.x + 0.55, z: 0.15 };                           // belakang kursi baris depan pod
}

// ============================================================================
// Ruangan berlorong tunggal: setiap titik disambung tegak lurus ke satu lorong lurus.
// Rute = keluar tegak lurus → menyusuri lorong → masuk tegak lurus.
// ============================================================================
/** Lorong sejajar sumbu X di z = `z0` (lokal). */
const laneZ = (z0: number) => (from: Pt, to: Pt): NavPt[] =>
  dedupe([{ ...from }, { x: from.x, z: z0 }, { x: to.x, z: z0 }, { ...to }]);
/** Lorong sejajar sumbu Z di x = `x0` (lokal). */
const laneX = (x0: number) => (from: Pt, to: Pt): NavPt[] =>
  dedupe([{ ...from }, { x: x0, z: from.z }, { x: x0, z: to.z }, { ...to }]);

/** Corridor_MainBus — lurus di sumbu tengah Jalan Utama (lokal z = 0, dunia Z = 6.2). */
export const busPath = laneZ(0);

/** Room_MeetingFoyer — jalur tengah terbuka (lokal x = 0, dunia X = 11.0). */
export const foyerPath = laneX(0);

/**
 * Room_ManagerOffice — lorong utara (dunia Z 8.6): pintu, kursi Raka (lewat celah antara
 * kredenza dan meja), dan titik tamu di depan meja semuanya tersambung lurus ke lorong ini.
 */
export const managerPath = laneZ(MANAGER.laneZ);

/**
 * Room_PantryCafe — lorong tengah segaris pintu (dunia X 6.5) di antara garis antrean
 * (barat) dan kursi bar (timur). Antrean, kursi bar, dan tempat sampah tersambung lurus ke sini.
 */
export const pantryPath = laneX(PANTRY.spineX);

/**
 * Lorong berupa polyline (Tahap 3). Titik asal & tujuan disambung ke titik terdekat pada
 * polyline, lalu rute menyusuri polyline di antara kedua proyeksi itu.
 */
export function polylineLane(points: readonly Pt[]) {
  const segs = points.slice(1).map((b, i) => ({ a: points[i]!, b }));
  const cum: number[] = [0];
  segs.forEach((sg, i) => cum.push(cum[i]! + segLen(sg.a, sg.b)));
  const project = (p: Pt) => {
    let best = { d: Infinity, t: 0, pt: points[0]! as Pt, seg: 0 };
    segs.forEach((sg, i) => {
      const dx = sg.b.x - sg.a.x, dz = sg.b.z - sg.a.z, L2 = dx * dx + dz * dz || 1;
      const u = Math.max(0, Math.min(1, ((p.x - sg.a.x) * dx + (p.z - sg.a.z) * dz) / L2));
      const q = { x: sg.a.x + dx * u, z: sg.a.z + dz * u };
      const d = segLen(p, q);
      if (d < best.d - 1e-9) best = { d, t: cum[i]! + u * Math.sqrt(L2), pt: q, seg: i };
    });
    return best;
  };
  return (from: Pt, to: Pt): NavPt[] => {
    const a = project(from), b = project(to);
    const mid: Pt[] = [];
    if (a.t < b.t) { for (let i = a.seg + 1; i <= b.seg; i++) mid.push(points[i]!); }
    else if (a.t > b.t) { for (let i = a.seg; i > b.seg; i--) mid.push(points[i]!); }
    return dedupe([{ ...from }, a.pt, ...mid, b.pt, { ...to }]);
  };
}

/** Room_LobbyReception — lorong tengah segaris pintu (dunia X 1.5), melewati karpet spawn. */
export const lobbyPath = laneX(LOBBY.spineX);

/** Room_LoungeRelax — lorong tengah segaris pintu (dunia X 11.5); kursi sofa di sisi barat. */
export const loungePath = laneX(LOUNGE.spineX);

/** Room_ServerIT — lorong U mengitari 2 rak di tengah: hot aisle → sisi timur → cold aisle. */
export const serverPath = polylineLane(SERVER.lane);

// ============================================================================
// Room_Boardroom_10p — promenade selatan, lorong utara, lorong barat & timur
// ============================================================================
type Lane = 'N' | 'S' | 'W' | 'E';

function boardroomLane(p: Pt): { pts: Pt[]; lane: Lane } {
  const { south, north, west, east } = BOARDROOM.lanes;
  const between = p.z < south && p.z > north;
  if (between && Math.abs(p.x - west) < 0.35) return { pts: [], lane: 'W' };
  if (between && Math.abs(p.x - east) < 0.35) return { pts: [], lane: 'E' };
  if (p.z < BOARDROOM.tableCenter.z) return { pts: [{ x: p.x, z: north }], lane: 'N' };
  return { pts: [{ x: p.x, z: south }], lane: 'S' };
}

/**
 * Pintu ruang rapat ada di tengah sisi selatan, jadi peserta menyebar mengitari meja:
 * dari dua lorong penghubung (barat / timur) dipakai yang rutenya lebih pendek.
 */
export function boardroomPath(from: Pt, to: Pt): NavPt[] {
  const ea = boardroomLane(from);
  const eb = boardroomLane(to);
  const a = ea.pts[ea.pts.length - 1] ?? from;
  const b = eb.pts[0] ?? to;
  const build = (middle: Pt[]) => dedupe([{ ...from }, ...ea.pts, ...middle, ...[...eb.pts].reverse(), { ...to }]);
  if (ea.lane === eb.lane && (ea.lane === 'N' || ea.lane === 'S')) return build([]);
  const via = (x: number) => build([{ x, z: a.z }, { x, z: b.z }]);
  const viaWest = via(BOARDROOM.lanes.west);
  const viaEast = via(BOARDROOM.lanes.east);
  return pathLength(viaEast) < pathLength(viaWest) - 0.01 ? viaEast : viaWest;
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

  type Hop = { c: NavConnector; fromRoom: string; toRoom: string };

  /**
   * Semua urutan konektor dari ruangan A ke B tanpa mengulang ruangan. Dua ruangan boleh
   * dihubungkan lebih dari satu pintu (ruang kerja punya 2 pintu ke Jalan Utama), jadi
   * rute dipilih belakangan berdasarkan panjang jalan sebenarnya, bukan jumlah lompatan.
   */
  const routeCache = new Map<string, Hop[][]>();
  const routes = (from: string, to: string): Hop[][] => {
    const key = `${from}>${to}`;
    const cached = routeCache.get(key);
    if (cached) return cached;
    const out: Hop[][] = [];
    const walk = (cur: string, seen: Set<string>, trail: Hop[]) => {
      if (cur === to) { out.push([...trail]); return; }
      for (const c of connectors) {
        const next = c.a.room === cur ? c.b.room : c.b.room === cur ? c.a.room : null;
        if (!next || seen.has(next)) continue;
        seen.add(next);
        trail.push({ c, fromRoom: cur, toRoom: next });
        walk(next, seen, trail);
        trail.pop();
        seen.delete(next);
      }
    };
    walk(from, new Set([from]), []);
    routeCache.set(key, out);
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
    const lastRoom = byId.get(rb)!;
    const along = (route: Hop[]): NavPt[] => {
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
      pts.push(...legWorld(lastRoom, cur, toWorld).slice(1, -1), { ...toWorld });
      return dedupe(pts);
    };

    let best: NavPt[] | null = null;
    let bestLen = Infinity;
    for (const route of routes(ra, rb)) {
      const pts = along(route);
      const len = pathLength(pts);
      if (len < bestLen - 1e-6) { best = pts; bestLen = len; }
    }
    return best ?? [{ ...fromWorld }, { ...toWorld }];
  };

  return { path, roomAt };
}

/** X pusat sebuah bukaan pintu. */
const mid = (d: { xMin: number; xMax: number }) => (d.xMin + d.xMax) / 2;
/** X dunia → X lokal Jalan Utama. */
const busX = (worldX: number) => worldX - CORRIDOR_BUS.origin.x;
const [DOOR_SW, DOOR_SE] = ROOM_MAIN.southDoors as readonly [{ xMin: number; xMax: number }, { xMin: number; xMax: number }];
const FOYER_DOOR_X = mid(ROOM_FOYER.southDoor);

/**
 * Konstanta portal (lokal masing-masing ruangan) untuk konektor gedung Lantai 1:
 * Ruang Kerja (2 pintu selatan) ↔ Jalan Utama ↔ Meeting Foyer ↔ Ruang Rapat (Tahap 1),
 * Jalan Utama ↔ Ruang Manajer & Pantry / Café (Tahap 2).
 *
 * Portal di sisi Jalan Utama selalu di sumbu tengah koridor (z = 0); portal di sisi ruangan
 * berada DI DALAM ruangan, tepat di depan pintunya (bukan di garis dinding).
 */
export const FLOOR1_PORTALS = {
  mainSouthWest: { x: mid(DOOR_SW), z: ROOM_MAIN.southDoorInsideZ },
  mainSouthEast: { x: mid(DOOR_SE), z: ROOM_MAIN.southDoorInsideZ },
  busWestDoor: { x: busX(ROOM_MAIN.origin.x + mid(DOOR_SW)), z: 0 },
  busEastDoor: { x: busX(ROOM_MAIN.origin.x + mid(DOOR_SE)), z: 0 },
  busFoyerDoor: { x: busX(ROOM_FOYER.origin.x + FOYER_DOOR_X), z: 0 },
  foyerSouth: { x: FOYER_DOOR_X, z: 0.6 },
  /** Titik antre door mutex arah masuk: tepat di luar pintu ruang rapat. */
  foyerNorth: { x: FOYER_DOOR_X, z: -0.6 },
  boardroomDoorInside: BOARDROOM.doorInside,
  /** Dunia (-4.0, 6.2) ↔ (-4.0, 8.05). */
  busManagerDoor: { x: busX(ROOM_MANAGER.origin.x + mid(ROOM_MANAGER.northDoor)), z: 0 },
  managerNorth: { x: mid(ROOM_MANAGER.northDoor), z: SOUTH_ROOM_DOOR_INSIDE_Z },
  /** Dunia (6.5, 6.2) ↔ (6.5, 8.05). */
  busPantryDoor: { x: busX(ROOM_PANTRY.origin.x + mid(ROOM_PANTRY.northDoor)), z: 0 },
  pantryNorth: { x: mid(ROOM_PANTRY.northDoor), z: SOUTH_ROOM_DOOR_INSIDE_Z },
  /** Tahap 3. Dunia (1.5, 6.2) ↔ (1.5, 8.05). */
  busLobbyDoor: { x: busX(ROOM_LOBBY.origin.x + mid(ROOM_LOBBY.northDoor)), z: 0 },
  lobbyNorth: { x: mid(ROOM_LOBBY.northDoor), z: SOUTH_ROOM_DOOR_INSIDE_Z },
  /** Dunia (11.5, 6.2) ↔ (11.5, 8.05). */
  busLoungeDoor: { x: busX(ROOM_LOUNGE.origin.x + mid(ROOM_LOUNGE.northDoor)), z: 0 },
  loungeNorth: { x: mid(ROOM_LOUNGE.northDoor), z: SOUTH_ROOM_DOOR_INSIDE_Z },
  /** Dunia (20.0, 6.2) ↔ (20.0, 8.05). */
  busServerDoor: { x: busX(ROOM_SERVER.origin.x + mid(ROOM_SERVER.northDoor)), z: 0 },
  serverNorth: { x: mid(ROOM_SERVER.northDoor), z: SOUTH_ROOM_DOOR_INSIDE_Z },
} as const;

export const BOARDROOM_DOOR_GATE = 'boardroom_door';
