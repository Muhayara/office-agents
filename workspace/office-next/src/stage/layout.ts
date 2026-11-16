/**
 * Tata letak gedung kantor: koordinat meja, pantry, dan penempatan layer ruangan.
 *
 * Konvensi (lihat docs/modular_office_layers_plan.md §2):
 * - X: Barat (-) ↔ Timur (+), Y: lantai 0 ke atas, Z: Utara (-) ↔ Selatan (+).
 * - rotation.y = 0 menghadap Selatan (+Z), π menghadap Utara, π/2 Timur, -π/2 Barat.
 *
 * Koordinat ruangan ditulis LOKAL terhadap pusat ruangannya. Posisi dunia hanya dibaca
 * lewat scene graph (getWorldPosition / localToWorld), sehingga ruangan bisa dipindah.
 */

export type Pt = { x: number; z: number };

/**
 * Posisi meja kerja di Room_MainWorkspace (lokal = dunia karena pusat ruang kerja di 0,0).
 * `chairSide` = arah letak KURSI relatif terhadap meja. Agen duduk di kursi itu dan
 * menghadap ke meja, yaitu rotasi `chairSide + π`.
 * Contoh: Raka `chairSide: π` → kursi di sisi utara meja, agen menghadap Selatan.
 */
export interface DeskSpot { x: number; z: number; rotY: number }

export const AGENT_3D_POSITIONS: Record<string, DeskSpot> = {
  // Meja eksekutif di dinding utara (kursi di utara meja, agen menghadap Selatan)
  raka:   { x: -3.8, z: -3.8, rotY: Math.PI }, // Manajer
  fajar:  { x:  3.0, z: -3.8, rotY: Math.PI }, // Penguji Visual

  // Pod 1 (Barat: Riset, Penulisan & Desain — 4 meja berhadapan)
  sari:   { x: -4.8, z: -2.3, rotY: Math.PI }, // Peneliti (baris belakang, menghadap Selatan)
  dimas:  { x: -2.8, z: -2.3, rotY: Math.PI }, // Penulis (baris belakang, menghadap Selatan)
  tari:   { x: -4.8, z: -0.9, rotY: 0 },       // Desainer UI/UX (baris depan, menghadap Utara)
  wulan:  { x: -2.8, z: -0.9, rotY: 0 },       // Artis Visual (baris depan, menghadap Utara)

  // Pod 2 (Timur: Engineering & Keamanan — 4 meja berhadapan)
  bima:   { x:  2.0, z: -2.3, rotY: Math.PI }, // Programmer
  gita:   { x:  4.0, z: -2.3, rotY: Math.PI }, // Game Dev 2.5D
  satria: { x:  2.0, z: -0.9, rotY: 0 },       // Keamanan
  laras:  { x:  4.0, z: -0.9, rotY: 0 },       // Reviewer
};

/** Titik duduk (lokal ruang kerja): 0.55 m dari pusat meja ke arah kursi. */
export function sitWorld(p: DeskSpot) {
  return {
    x: p.x + 0.55 * Math.sin(p.rotY),
    y: 0.45,
    z: p.z + 0.55 * Math.cos(p.rotY),
  };
}

// ---------------------------------------------------------------------------
// Pantry & antrean kopi (Room_MainWorkspace, lokal)
// ---------------------------------------------------------------------------
export const COFFEE_BAR_POS = { x: -3.8, z: 4.1 };
export const TRASH_BIN_POS  = { x: -5.0, z: 4.1 };
/** Titik berdiri di depan tempat sampah (bukan di dalam tong). */
export const TRASH_STAND    = { x: -5.0, z: 3.75 };
export const WATER_DISPENSER_POS = { x: -5.55, z: 4.35 };

/** Slot 0 di depan mesin espresso, slot 1-3 berbaris rapi di belakangnya. */
export const COFFEE_QUEUE_SPOTS: Pt[] = [
  { x: -3.8, z: 3.4 },
  { x: -3.8, z: 2.5 },
  { x: -3.8, z: 1.6 },
  { x: -3.8, z: 0.7 },
];

/** Meja diskusi bundar (huddle) di ruang kerja. Rapat penuh sekarang di ruang rapat. */
export const HUDDLE_TABLE_POS = { x: 0.2, z: 2.2 };

// ---------------------------------------------------------------------------
// Layer ruangan di Lantai 1 (posisi grup = pusat ruangan di dunia)
// ---------------------------------------------------------------------------
export const ROOM_MAIN = {
  name: 'Room_MainWorkspace',
  origin: { x: 0, z: 0 },
  halfX: 7.0,
  halfZ: 5.0,
  /** Sekat kaca timur bawaan office_room_shell.glb dan celah pintunya. */
  eastPartitionX: 6.70,
  eastDoor: { zMin: 1.65, zMax: 3.05, z: 2.35 },
  /** Titik di dalam ruang kerja tepat di depan celah pintu timur. */
  eastDoorInside: { x: 6.0, z: 2.35 },
} as const;

export const CORRIDOR_EAST = {
  name: 'Corridor_East_Connector',
  /** Bentang dunia X 6.70..9.50, Z 1.35..3.35. */
  origin: { x: 8.10, z: 2.35 },
  halfLength: 1.40,
  halfWidth: 1.00,
  /** Titik antre door mutex (lokal), dunia (8.80, 2.35). */
  doorQueue: { x: 0.70, z: 0 },
} as const;

export const ROOM_BOARDROOM = {
  name: 'Room_Boardroom_10p',
  origin: { x: 13.5, z: 0 },
  half: 4.0,
} as const;

// ---------------------------------------------------------------------------
// Ruang rapat (semua koordinat LOKAL terhadap pusat Room_Boardroom_10p)
// ---------------------------------------------------------------------------
export const BOARDROOM = {
  wallInner: -3.76,
  tableCenter: { x: 0.6, z: -0.6 },
  tableLength: 4.0,
  tableWidth: 1.2,
  /** TV 85" di Dinding Barat, menghadap Timur. y = titik tengah layar. */
  tv: { x: -3.70, y: 1.45, z: -0.60 },
  /** Kredenza menempel dinding utara (belakang 0.45 m tepat di permukaan dinding). */
  credenza: { x: 0.5, z: -3.53 },
  ac: { x: 0.5, y: 2.45, z: -3.76 },
  whiteboard: { x: 2.6, z: -3.35 },
  plantNW: { x: -3.35, z: -3.35 },
  plantNE: { x: 3.62, z: -3.05 },
  pendant: { x: 0.6, z: -0.6 },
  door: { x: -4.0, zMin: 1.65, zMax: 3.05, z: 2.35 },
  /** Titik antre sisi dalam pintu (door mutex arah keluar), dunia (10.20, 2.35). */
  doorInside: { x: -3.30, z: 2.35 },
  /** Jalur jalan: promenade selatan, lorong utara (di depan kredenza), lorong barat (zona presenter). */
  lanes: { south: 2.35, north: -2.85, west: -2.30 },
  seatHeight: 0.46,
} as const;

export type SeatRow = 'N' | 'S';

export interface BoardroomSeat {
  id: string;
  row: SeatRow;
  x: number;
  zTucked: number;
  zPulled: number;
  /** Titik berdiri di belakang kursi yang ditarik, sebelum duduk / setelah berdiri. */
  zApproach: number;
  /** Arah hadap kursi ke meja (N menghadap Selatan, S menghadap Utara). */
  rotY: number;
}

const SEAT_X = [-0.80, -0.10, 0.60, 1.30, 2.00];

/** 10 seat anchor formasi 5+5 (plan §6). */
export const BOARDROOM_SEATS: BoardroomSeat[] = [
  ...SEAT_X.map((x, i) => ({
    id: `N${i + 1}`, row: 'N' as const, x, zTucked: -1.60, zPulled: -1.90, zApproach: -2.45, rotY: 0,
  })),
  ...SEAT_X.map((x, i) => ({
    id: `S${i + 1}`, row: 'S' as const, x, zTucked: 0.40, zPulled: 0.70, zApproach: 1.25, rotY: Math.PI,
  })),
];

/** Penugasan kursi resmi (plan §6). Agen tanpa penugasan memakai kursi kosong pertama. */
export const MEETING_SEAT_ASSIGNMENT: Record<string, string> = {
  laras: 'N1',
  gita: 'N2',
  raka: 'N3',
  bima: 'N4',
  fajar: 'N5',
  wulan: 'S1',
  tari: 'S2',
  sari: 'S3',
  dimas: 'S4',
  satria: 'S5',
};

// ---------------------------------------------------------------------------
// Waktu & ritme rapat
// ---------------------------------------------------------------------------
export const WALK_SPEED = 2.2;
/** Jeda keberangkatan antar-agen (plan §8.2). */
export const MEETING_DEPART_GAP_S = 0.9;
/** Jarak waktu minimum antar-agen yang melewati pintu ruang rapat (door mutex). */
export const DOOR_MUTEX_GAP_S = 0.8;
/** Lama sesi rapat dihitung SETELAH semua peserta duduk. */
export const MEETING_SESSION_S = 24;
/** Bagian awal sesi: kursi diputar menghadap TV (presentasi). */
export const MEETING_PRESENT_S = 13;
/** Batas tunggu peserta yang tersangkut sebelum sesi tetap dimulai. */
export const MEETING_GATHER_TIMEOUT_S = 45;
