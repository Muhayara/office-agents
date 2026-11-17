/**
 * Tata letak gedung kantor: koordinat meja, pantry, dan penempatan layer ruangan.
 * Topologi Lantai 1 (Tahap 1): Ruang Kerja ↔ Jalan Utama (bus) ↔ Meeting Foyer ↔ Ruang Rapat.
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
// Dimensi dinding penuh (dipakai semua ruangan baru sejak Tahap 1)
// ---------------------------------------------------------------------------
export const WALL_HEIGHT = 3.2;
export const WALL_THICKNESS = 0.24;
/** Tinggi bersih bukaan pintu (sama dengan portal Office_Boardroom_Shell.glb). */
export const DOOR_HEIGHT = 2.57;

// ---------------------------------------------------------------------------
// Pantry & antrean kopi (Room_MainWorkspace, lokal)
//
// Tahap 1: klaster pantry digeser ke sudut barat daya karena pintu selatan-barat
// (X = -3.5) menempati posisi coffee bar lama. Sementara, sampai pindah ke Pantry / Café
// di Tahap 2. Semua benda berjarak dari baseboard dinding selatan (Z = 4.66).
// ---------------------------------------------------------------------------
export const COFFEE_BAR_POS = { x: -5.8, z: 4.33 };
/** Di antara coffee bar dan kusen pintu selatan-barat. */
export const WATER_DISPENSER_POS = { x: -4.59, z: 4.45 };
/** Di sisi timur pintu selatan-barat. */
export const TRASH_BIN_POS  = { x: -2.4, z: 4.46 };
/** Titik berdiri di depan tempat sampah (bukan di dalam tong). */
export const TRASH_STAND    = { x: -2.4, z: 4.03 };

/** Slot 0 di depan mesin espresso, slot 1-3 berbaris rapi di belakangnya (ke utara). */
export const COFFEE_QUEUE_SPOTS: Pt[] = [
  { x: -5.8, z: 3.6 },
  { x: -5.8, z: 2.7 },
  { x: -5.8, z: 1.8 },
  { x: -5.8, z: 0.9 },
];
/** Arah hadap agen di antrean / depan mesin: coffee bar ada di selatan (+Z). */
export const COFFEE_FACE_ROT = 0;
/** Arah hadap agen di depan tempat sampah (+Z). */
export const TRASH_FACE_ROT = 0;

/** Meja diskusi bundar (huddle) di ruang kerja. Rapat penuh sekarang di ruang rapat. */
export const HUDDLE_TABLE_POS = { x: 0.2, z: 2.2 };

// ---------------------------------------------------------------------------
// Layer ruangan di Lantai 1 (posisi grup = pusat ruangan di dunia)
// ---------------------------------------------------------------------------
//
// Tapak Lantai 1 (blueprint V6.2): 38 × 18,4 m, dunia X -7..31, Z -5..13.4.
// Konversi dari denah: worldX = tapakX - 7, worldZ = tapakZ - 5.
// ---------------------------------------------------------------------------
export interface DoorSpan { xMin: number; xMax: number }

export const ROOM_MAIN = {
  name: 'Room_MainWorkspace',
  origin: { x: 0, z: 0 },
  halfX: 7.0,
  halfZ: 5.0,
  /** Sekat kaca timur bawaan office_room_shell.glb. Kini berbatasan dengan dinding barat ruang rapat. */
  eastPartitionX: 6.70,
  /** Celah pintu timur lama pada sekat kaca: ditutup panel kaca mati (bukan lagi jalur navigasi). */
  eastGap: { zMin: 1.65, zMax: 3.05 },
  /** Dinding selatan penuh (Tahap 1): pusat tebal di Z = 4.88, permukaan dalam Z = 4.76. */
  southWallZ: 4.88,
  /** Dua pintu ke Jalan Utama: 3,5 m & 10,5 m tapak (bukaan 1,4 m). */
  southDoors: [
    { xMin: -4.2, xMax: -2.8 },
    { xMin: 2.8, xMax: 4.2 },
  ] as readonly DoorSpan[],
  /** Z titik berdiri di dalam ruang kerja tepat di depan pintu selatan. */
  southDoorInsideZ: 4.3,
} as const;

export const ROOM_BOARDROOM = {
  name: 'Room_Boardroom_10p',
  /** Bentang dunia X 7..15, Z -5..3 (menempel sisi timur ruang kerja). */
  origin: { x: 11.0, z: -1.0 },
  half: 4.0,
} as const;

export const ROOM_FOYER = {
  name: 'Room_MeetingFoyer',
  /** Bentang dunia X 7..15, Z 3..5. */
  origin: { x: 11.0, z: 4.0 },
  halfX: 4.0,
  halfZ: 1.0,
  /** Pintu tengah ke Jalan Utama (lokal), segaris dengan pintu selatan ruang rapat. */
  southDoor: { xMin: -0.85, xMax: 0.85 } as DoorSpan,
  /** Dinding selatan foyer: pusat tebal lokal Z = +0.88 (dunia 4.88). */
  southWallZ: 0.88,
} as const;

export const CORRIDOR_BUS = {
  name: 'Corridor_MainBus',
  /** Jalan Utama 38 × 2,4 m: bentang dunia X -7..31, Z 5.0..7.4. */
  origin: { x: 12.0, z: 6.2 },
  halfLength: 19.0,
  halfWidth: 1.2,
} as const;

/**
 * Muka ruangan di sepanjang Jalan Utama (rentang X dunia). Selama `built` masih false,
 * ruasnya ditutup dinding kaca sementara oleh mainCorridor.ts. Saat ruangannya dibangun
 * (Tahap 2–6), ubah `built` menjadi true: ruangan itu membawa dinding berpintunya sendiri.
 */
export interface BusFrontage { id: string; xMin: number; xMax: number; tahap: number; built: boolean }

/** Sisi selatan Jalan Utama (dinding di Z dunia 7.40..7.64, di dalam tapak ruangan selatan). */
export const BUS_FRONTAGE_SOUTH: readonly BusFrontage[] = [
  { id: 'manager', xMin: -7, xMax: -1, tahap: 2, built: false },
  { id: 'lobby',   xMin: -1, xMax: 4,  tahap: 3, built: false },
  { id: 'pantry',  xMin: 4,  xMax: 9,  tahap: 2, built: false },
  { id: 'lounge',  xMin: 9,  xMax: 14, tahap: 3, built: false },
  { id: 'focus',   xMin: 14, xMax: 18, tahap: 6, built: false },
  { id: 'server',  xMin: 18, xMax: 22, tahap: 3, built: false },
  { id: 'garden',  xMin: 22, xMax: 27, tahap: 4, built: false },
  { id: 'access',  xMin: 27, xMax: 31, tahap: 6, built: false },
];

/** Sisi utara ruas timur (dinding di Z dunia 4.76..5.00). Ruas barat milik ruang kerja & foyer. */
export const BUS_FRONTAGE_NORTH: readonly BusFrontage[] = [
  { id: 'commons',  xMin: 15, xMax: 25, tahap: 4, built: false },
  { id: 'workshop', xMin: 25, xMax: 31, tahap: 5, built: false },
];

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
  /** Portal pintu barat bawaan GLB (kini menghadap ruang kerja): ditutup dinding pengisi. */
  westDoorPlug: { zMin: 1.63, zMax: 3.07 },
  /** Pintu selatan tengah ke Meeting Foyer (bukaan 1,7 m). Pusat tebal dinding Z = 3.88. */
  southDoor: { xMin: -0.85, xMax: 0.85 } as DoorSpan,
  southWallZ: 3.88,
  /** Titik antre sisi dalam pintu selatan (door mutex arah keluar), dunia (11.0, 1.35). */
  doorInside: { x: 0, z: 2.35 },
  /**
   * Jalur jalan: promenade selatan, lorong utara (di depan kredenza), lorong barat
   * (zona presenter) dan lorong timur. Rute memilih lorong barat/timur yang lebih pendek.
   */
  lanes: { south: 2.35, north: -2.85, west: -2.30, east: 3.05 },
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
