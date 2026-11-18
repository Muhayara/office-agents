/**
 * Tata letak gedung kantor: koordinat meja, pantry, dan penempatan layer ruangan.
 * Topologi Lantai 1 (Tahap 2): Ruang Kerja ↔ Jalan Utama (bus) ↔ Meeting Foyer ↔ Ruang Rapat,
 * plus Ruang Manajer & Pantry / Café di sisi selatan Jalan Utama.
 *
 * Konvensi (lihat docs/modular_office_layers_plan.md §2):
 * - X: Barat (-) ↔ Timur (+), Y: lantai 0 ke atas, Z: Utara (-) ↔ Selatan (+).
 * - rotation.y = 0 menghadap Selatan (+Z), π menghadap Utara, π/2 Timur, -π/2 Barat.
 *
 * Koordinat ruangan ditulis LOKAL terhadap pusat ruangannya. Posisi dunia hanya dibaca
 * lewat scene graph (getWorldPosition / localToWorld), sehingga ruangan bisa dipindah.
 */

export type Pt = { x: number; z: number };
/** Titik berdiri beserta arah hadap agen di titik itu. */
export type Spot = Pt & { rotY: number };

/** Ruangan yang memuat meja kerja agen. */
export type DeskRoom = 'main' | 'manager';

/**
 * Posisi meja kerja, LOKAL terhadap ruangannya (`room`, bawaan Room_MainWorkspace).
 * `rotY` = rotasi meja; kursi berada 0,55 m ke arah (sin rotY, cos rotY) dan agen duduk
 * menghadap ke meja, yaitu rotasi `rotY + π`.
 * Contoh: Fajar `rotY: π` → kursi di sisi utara meja, agen menghadap Selatan.
 */
export interface DeskSpot {
  x: number;
  z: number;
  rotY: number;
  room?: DeskRoom;
  /** `executive` = meja L walnut di Ruang Manajer (bukan desk.glb). */
  style?: 'executive';
}

export const AGENT_3D_POSITIONS: Record<string, DeskSpot> = {
  // Tahap 2: Manajer pindah ke Ruang Manajer (meja L menghadap Timur, kredenza di belakangnya)
  raka:   { room: 'manager', x: -1.0, z: 0, rotY: -Math.PI / 2, style: 'executive' },
  // Meja eksekutif di dinding utara ruang kerja (kursi di utara meja, agen menghadap Selatan)
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

/** Titik duduk (lokal ruangan meja): 0.55 m dari pusat meja ke arah kursi. */
export function sitLocal(p: DeskSpot) {
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

/** Meja diskusi bundar (huddle) di ruang kerja. Rapat penuh sekarang di ruang rapat. */
export const HUDDLE_TABLE_POS = { x: 0.2, z: 2.2 };
/**
 * Whiteboard scrum di bekas meja Raka (dinding utara ruang kerja, Tahap 2).
 * Kaki GLB menonjol 0,276 m ke belakang: pusat 0,29 m dari permukaan dinding (Z -4.76).
 */
export const WORKSPACE_WHITEBOARD_POS = { x: -3.8, z: -4.47 };

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
  { id: 'manager', xMin: -7, xMax: -1, tahap: 2, built: true },
  { id: 'lobby',   xMin: -1, xMax: 4,  tahap: 3, built: true },
  { id: 'pantry',  xMin: 4,  xMax: 9,  tahap: 2, built: true },
  { id: 'lounge',  xMin: 9,  xMax: 14, tahap: 3, built: true },
  { id: 'focus',   xMin: 14, xMax: 18, tahap: 6, built: true },
  { id: 'server',  xMin: 18, xMax: 22, tahap: 3, built: true },
  { id: 'garden',  xMin: 22, xMax: 27, tahap: 4, built: true },
  { id: 'access',  xMin: 27, xMax: 31, tahap: 6, built: true },
];

/** Sisi utara ruas timur (dinding di Z dunia 4.76..5.00). Ruas barat milik ruang kerja & foyer. */
export const BUS_FRONTAGE_NORTH: readonly BusFrontage[] = [
  { id: 'commons',  xMin: 15, xMax: 25, tahap: 4, built: true },
  { id: 'workshop', xMin: 25, xMax: 31, tahap: 5, built: true },
];

// ---------------------------------------------------------------------------
// Ruangan sisi selatan Jalan Utama (Tahap 2+): tapak dunia Z 7.4..13.4 (6 m)
//
// Semua dinding berdiri DI DALAM tapak ruangannya (tebal WALL_THICKNESS):
// - Utara : dinding kaca berpintu, dunia Z 7.40..7.64 (garis yang sama dengan kaca sementara
//           Jalan Utama, jadi lebar koridor tetap 2,4 m).
// - Selatan: dinding luar gedung, Z 13.16..13.40.
// - Barat / Timur: X tepi tapak ± 0,24 m.
// ---------------------------------------------------------------------------
export interface SouthRoomSpec {
  name: string;
  /** Pusat tapak di dunia. */
  origin: Pt;
  halfX: number;
  halfZ: number;
  /** Bukaan pintu dinding utara ke Jalan Utama (lokal). */
  northDoor: DoorSpan;
}

/** Z lokal titik berdiri di dalam ruangan tepat di depan pintu utara (dunia Z 8.05). */
export const SOUTH_ROOM_DOOR_INSIDE_Z = -2.35;

export const ROOM_MANAGER = {
  name: 'Room_ManagerOffice',
  /** Bentang dunia X -7..-1, Z 7.4..13.4 (6 × 6 m). */
  origin: { x: -4.0, z: 10.4 },
  halfX: 3.0,
  halfZ: 3.0,
  /** Pintu geser kaca di tengah, dunia X -4.7..-3.3 (3 m tapak). */
  northDoor: { xMin: -0.7, xMax: 0.7 },
} as const satisfies SouthRoomSpec;

export const ROOM_PANTRY = {
  name: 'Room_PantryCafe',
  /** Bentang dunia X 4..9, Z 7.4..13.4 (5 × 6 m). */
  origin: { x: 6.5, z: 10.4 },
  halfX: 2.5,
  halfZ: 3.0,
  /** Bukaan terbuka di tengah, dunia X 5.8..7.2 (13,5 m tapak). */
  northDoor: { xMin: -0.7, xMax: 0.7 },
} as const satisfies SouthRoomSpec;

// ---------------------------------------------------------------------------
// Ruang Manajer (semua koordinat LOKAL terhadap pusat Room_ManagerOffice)
//
// Kamera isometrik memandang dari Tenggara, jadi satu-satunya dinding yang tetap solid
// adalah dinding barat (tepi gedung): kredenza, TV KPI, dan rak buku menempel di sana.
// Raka duduk membelakangi kredenza, menghadap Timur (ke pintu & kursi tamu).
// ---------------------------------------------------------------------------
export const MANAGER = {
  /** Lorong utara: semua titik ruangan disambung lurus Utara–Selatan ke lorong ini. */
  laneZ: -1.8,
  /**
   * Meja L Raka (Office_Manager_L_Desk.glb): origin = pusat sayap utama 1,8 × 0,8 m, atas 0,75 m.
   * Sayap return (atas 0,72 m) di sisi KANAN Raka (+X workstation = Selatan dunia) dan menjorok
   * ke arah kursi sampai kedalaman total 1,6 m; sisi kiri (Utara) bebas untuk jalan ke kursi.
   */
  deskTopY: 0.75,
  /** Titik berdiri tamu / agen yang minta review, 0,4 m di depan meja Raka. */
  visitSpot: { x: -0.2, z: 0 } as Pt,
  /** Kredenza walnut (belakang 0,45 m menempel muka dinding barat X -2.76), menghadap Timur. */
  credenza: { x: -2.535, z: 0 },
  /** TV KPI 55" (GLB display 85" diskala 0,65) di dinding barat, di atas kredenza. */
  tv: { x: -2.755, y: 1.78, z: 0, scale: 0.65 },
  bookshelf: { x: -2.56, z: -1.95 },
  /** 2 kursi tamu menghadap meja (sedikit menyerong ke tengah). */
  guestChairs: [
    { x: 0.45, z: -0.6, rotY: -Math.PI / 2 + 0.2 },
    { x: 0.45, z: 0.6, rotY: -Math.PI / 2 - 0.2 },
  ] as Spot[],
  rug: { x: 0.35, z: 0, w: 1.7, d: 2.6 },
  plantSW: { x: -2.3, z: 2.3 },
  plantNE: { x: 2.3, z: -2.36 },
  /** Jendela palsu (pemandangan kota) + slat walnut di muka dalam dinding selatan. */
  window: { xMin: -1.4, xMax: 1.4, yMin: 0.95, yMax: 2.45 },
  light: { x: -0.9, y: 2.7, z: 0 },
} as const;

// ---------------------------------------------------------------------------
// Pantry / Café (semua koordinat LOKAL terhadap pusat Room_PantryCafe)
//
// Coffee Bar menempel dinding BARAT dan menghadap Timur supaya agen yang menyeduh terlihat
// dari kamera Tenggara (di dinding selatan ia tertutup badan bar). Antrean berbaris ke utara
// sepanjang muka bar; lorong tengah (spine X = 0) lurus dari pintu ke kursi bar island.
// Benda tinggi hanya di dinding barat: di sisi utara ia menutupi Jalan Utama dari kamera.
// ---------------------------------------------------------------------------
export const PANTRY = {
  /** Lorong tengah segaris pintu; semua titik ruangan disambung lurus Timur–Barat ke lorong ini. */
  spineX: 0,
  /** Office_Coffee_Bar.glb 1,8 × 0,65 m, belakang menempel muka dinding barat (X -2.26). */
  coffeeBar: { x: -1.935, z: 0.5, rotY: Math.PI / 2 },
  waterDispenser: { x: -2.07, z: 1.64, rotY: Math.PI / 2 },
  /**
   * Kabinet utilitas tinggi (Office_Pantry_Utility_Cabinet.glb 0,80 × 0,60 × 1,85 m), sudut barat
   * daya. Origin GLB = tengah sisi BELAKANG di lantai → slot tepat di muka dinding barat (X -2.26).
   */
  utility: { x: -2.26, z: 2.35, rotY: Math.PI / 2, w: 0.8, d: 0.6, h: 1.85 },
  /**
   * Kitchen counter + sink (Office_Pantry_Kitchen_Counter.glb 3,20 × 0,65 m, atas 0,90 m,
   * backsplash sampai 1,25 m). Origin GLB = tengah sisi BELAKANG → slot di muka dinding selatan.
   */
  counter: { x: 0.05, z: 2.76, rotY: Math.PI, length: 3.2, depth: 0.65, top: 0.9, splashTop: 1.25 },
  /** Bar island (Office_Pantry_Bar_Island.glb 0,90 × 2,40 × 1,05 m) membujur Utara–Selatan. */
  island: { x: 1.25, z: 0, w: 0.9, d: 2.4, h: 1.05 },
  /** 4 kursi bar (Office_Pantry_Bar_Stool.glb, dudukan 0,75 m) di sisi barat island, menghadap Timur. */
  stoolX: 0.5,
  stoolZ: [-0.625, -0.075, 0.475, 1.025],
  stoolRotY: Math.PI / 2,
  /** Tinggi avatar saat duduk di kursi bar (permukaan dudukan 0,75 m). */
  stoolSitY: 0.65,
  /** Slot 0 di depan mesin espresso (menghadap bar), slot 1–3 berbaris ke utara menghadap kepala antrean. */
  queue: [
    { x: -1.15, z: 0.97, rotY: -Math.PI / 2 },
    { x: -1.15, z: 0.07, rotY: 0 },
    { x: -1.15, z: -0.83, rotY: 0 },
    { x: -1.15, z: -1.73, rotY: 0 },
  ] as Spot[],
  /** Tempat sampah di samping pintu (dibuang sambil keluar), titik berdiri menghadap Utara. */
  trashBin: { x: 1.05, z: -2.54 },
  trashStand: { x: 1.05, z: -2.05, rotY: Math.PI } as Spot,
  plantNW: { x: -1.95, z: -2.4 },
  plantSE: { x: 1.97, z: 2.42 },
  /** Papan menu di dinding barat, di atas coffee bar. */
  menuBoard: { x: -2.255, y: 1.85, z: 0.5 },
  baristaLight: { x: -1.45, y: 2.4, z: 0.6 },
} as const;

// ---------------------------------------------------------------------------
// Tahap 3: Lobi & Resepsionis, Lounge, Server / IT (sisi selatan Jalan Utama)
//
// Lobi tidak punya dinding samping sendiri: diapit dinding timur Ruang Manajer (X -1.24..-1.0)
// dan dinding barat Pantry (X 4.0..4.24). Lounge memakai dinding timur Pantry (X 8.76..9.0)
// sebagai dinding baratnya. Dari kamera Tenggara semua dinding ruangan ini memudar, jadi benda
// "pajangan" (logo, lukisan, layar NOC, CRAC) menempel di sisi BARAT dan menghadap Timur.
// ---------------------------------------------------------------------------
export const ROOM_LOBBY = {
  name: 'Room_LobbyReception',
  /** Bentang dunia X -1..4, Z 7.4..13.4 (5 × 6 m). */
  origin: { x: 1.5, z: 10.4 },
  halfX: 2.5,
  halfZ: 3.0,
  /** Pintu kaca geser ganda otomatis 1,6 m, dunia X 0.7..2.3 (8,5 m tapak). */
  northDoor: { xMin: -0.8, xMax: 0.8 },
} as const satisfies SouthRoomSpec;

export const ROOM_LOUNGE = {
  name: 'Room_LoungeRelax',
  /** Bentang dunia X 9..14, Z 7.4..13.4 (5 × 6 m), di seberang Meeting Foyer. */
  origin: { x: 11.5, z: 10.4 },
  halfX: 2.5,
  halfZ: 3.0,
  /** Bukaan kaca 1,4 m, dunia X 10.8..12.2 (18,5 m tapak). */
  northDoor: { xMin: -0.7, xMax: 0.7 },
} as const satisfies SouthRoomSpec;

export const ROOM_SERVER = {
  name: 'Room_ServerIT',
  /** Bentang dunia X 18..22, Z 7.4..13.4 (4 × 6 m). */
  origin: { x: 20.0, z: 10.4 },
  halfX: 2.0,
  halfZ: 3.0,
  /** Pintu baja 1,0 m berakses RFID, dunia X 19.5..20.5 (27 m tapak). */
  northDoor: { xMin: -0.5, xMax: 0.5 },
} as const satisfies SouthRoomSpec;

/** Lobi (LOKAL terhadap pusat Room_LobbyReception). Lantai bersih X -2.5..2.5, Z -2.76..2.76. */
export const LOBBY = {
  spineX: 0,
  /** Karpet selamat datang = titik spawn agen yang baru hadir (menghadap pintu, Utara). */
  spawn: { x: 0, z: 0.55, rotY: Math.PI } as Spot,
  /** Dinding fitur marmer hitam + logo berlampu, menempel muka dinding barat (X -2.5), menghadap Timur. */
  featureWall: { x: -2.47, z: 0.7, w: 2.8, h: 2.6, t: 0.06 },
  /**
   * Meja resepsionis melengkung (GLB `Office_Lobby_Reception_Desk`: origin = puncak busur depan,
   * muka cembung ke -Z, pusat busur di (0, 0, Ro)). Diputar -90° agar muka menghadap Timur:
   * jejak X -2.45..-0.95, Z -0.5..1.9 (dunia X -0.95..0.55, Z 9.9..12.3).
   */
  reception: { apexX: -0.95, apexZ: 0.7, rotY: -Math.PI / 2, Ro: 1.6, Ri: 0.756, ledgeIn: 1.215, halfDeg: 48.59 },
  receptionistChair: { x: -2.0, z: 0.7, rotY: Math.PI / 2 } as Spot,
  /** Kios direktori digital di dekat pintu, layar menghadap Selatan (ke dalam lobi & kamera). */
  kiosk: { x: 1.9, z: -1.75, rotY: 0 } as Spot,
  /** Meja samping marmer (GLB `Office_Lobby_Side_Table`: Ø0,60, permukaan marmer 0,54 m) di antara 2 kursi aksen. */
  sideTable: { x: 1.7, z: 1.65 },
  accentChairs: [
    { x: 0.98, z: 1.65, rotY: Math.PI / 2 },
    { x: 1.7, z: 0.92, rotY: 0 },
  ] as Spot[],
  plants: [{ x: -2.1, z: 2.4 }, { x: 2.1, z: 2.4 }] as Pt[],
  light: { x: 0, y: 2.7, z: 0.5 },
  /** Jarak agen ke tengah pintu yang membuka pintu otomatis. */
  doorSense: 1.6,
} as const;

/** Lounge (LOKAL terhadap pusat Room_LoungeRelax). Lantai bersih X -2.5..2.26, Z -2.76..2.76. */
export const LOUNGE = {
  /** Lorong tunggal: pintu → belok barat → menyusuri depan sofa (X -1.3) hingga ujung chaise. */
  lane: [{ x: 0, z: -2.35 }, { x: 0, z: -1.2 }, { x: -1.3, z: -1.2 }, { x: -1.3, z: 1.6 }] as Pt[],
  /**
   * Sofa sectional L (GLB `Office_Lounge_Sectional_Sofa`: origin = sudut belakang-kiri, X 0..2.60,
   * Z 0..1.80, hadap +Z, chaise di sisi -X). Diputar +90°: punggung menempel dinding barat, chaise
   * menyusuri dinding selatan. Ruangan: main X -2.485..-1.585 × Z 0.145..2.745,
   * chaise X -2.485..-0.685 × Z 1.832..2.745.
   */
  sofa: { originX: -2.485, originZ: 2.745, rotY: Math.PI / 2, width: 2.6, depth: 1.8, mainDepth: 0.9, armW: 0.14, chaiseW: 0.913, seatTop: 0.44, backTop: 0.78 },
  /** Kursi yang bisa diduduki agen + titik berdiri sebelum duduk (di lorong X -1.3, bebas meja kopi). */
  seats: [
    { spot: { x: -1.935, z: 0.672, rotY: Math.PI / 2 }, approach: { x: -1.3, z: 0.672 } },
    { spot: { x: -1.935, z: 1.445, rotY: Math.PI / 2 }, approach: { x: -1.3, z: 1.445 } },
    { spot: { x: -1.1, z: 2.03, rotY: Math.PI }, approach: { x: -1.1, z: 1.53 } },
  ] as Array<{ spot: Spot; approach: Pt }>,
  /** Tinggi avatar saat duduk di sofa (dudukan 0,44 m). */
  sitY: 0.34,
  /** Meja kopi 1,10 × 0,65 × 0,42 diputar 90° (sisi panjang sejajar sofa): X -1.0..-0.35, Z 0.25..1.35. */
  coffeeTable: { x: -0.675, z: 0.8, rotY: Math.PI / 2, w: 1.1, d: 0.65, h: 0.42 },
  /** Lampu busur (kap di +Z lokal sejauh `reach`, rim 1,65 m), di-yaw agar kap menggantung di atas meja kopi. */
  arcLamp: { baseX: -0.25, baseZ: 2.35, aimX: -0.675, aimZ: 0.8, reach: 1.2, rimY: 1.65 },
  /**
   * Areca palm (GLB `Office_Plant_Areca_Palm`: kanopi maks. Ø1,10, tinggi 1,70) di sudut barat laut.
   * Pusat 0,57 m dari muka dinding barat & kaca utara supaya kanopi r 0,55 tidak menembus dinding.
   */
  palm: { x: -1.93, z: -2.19 },
  /** Rak majalah (GLB 0,34 × 0,90 × 0,30, depan +Z) diputar 90°: menghadap Timur, X -2.35..-2.05. */
  magazineRack: { x: -2.2, z: -1.2 },
  /** Lukisan kanvas & rak tipis di muka dinding barat (dinding timur Pantry), menghadap Timur. */
  art: { x: -2.48, y: 1.85, z: 0.85, w: 1.5, h: 0.95 },
  shelf: { x: -2.4, y: 1.3, z: -1.3, len: 1.0 },
} as const;

/** Server / IT (LOKAL terhadap pusat Room_ServerIT). Lantai bersih X -1.76..1.76, Z -2.76..2.76. */
export const SERVER = {
  /** 2× Server_Rack_42U.glb berdampingan di tengah, depan (+Z GLB) menghadap Selatan / kamera. */
  racks: [{ x: -0.385, z: -0.5 }, { x: 0.385, z: -0.5 }] as Pt[],
  /** Lorong berbentuk U: belakang rak (hot aisle) → sisi timur → depan rak (cold aisle). */
  lane: [{ x: 0, z: -1.65 }, { x: 1.25, z: -1.65 }, { x: 1.25, z: 0.65 }, { x: -0.6, z: 0.65 }] as Pt[],
  /** Titik inspeksi di cold aisle, menghadap rak (Utara). */
  inspect: { x: 0, z: 0.6, rotY: Math.PI } as Spot,
  /**
   * Konsol IT admin (GLB `Office_Server_Admin_Console`: origin = belakang-tengah, pengguna di +Z)
   * menempel panel akustik selatan, diputar 180°: meja X 0.15..1.55, Z 2.03..2.73. Agen duduk
   * menghadap Selatan (ke monitor ganda).
   */
  console: { x: 0.85, z: 2.73, rotY: Math.PI, w: 1.4, d: 0.7 },
  consoleSeat: { spot: { x: 0.85, z: 1.82, rotY: 0 } as Spot, approach: { x: 0.85, z: 1.27 } as Pt },
  /**
   * Unit AC presisi (GLB `Office_Server_CRAC_Unit`: origin = belakang-bawah-tengah, depan +Z)
   * menempel panel akustik barat, menghadap Timur: X -1.73..-0.98, Z 0.4..1.6.
   */
  crac: { x: -1.73, z: 1.0, rotY: Math.PI / 2, w: 1.2, d: 0.75, h: 2.05 },
  /** Layar NOC 55" (GLB display diskala 0,65) di dinding barat, menghadap Timur. */
  noc: { x: -1.755, y: 1.75, z: -1.35, scale: 0.65 },
  extinguisher: { x: -0.95, z: -2.62 },
  firstAid: { x: -1.35, y: 1.45, z: -2.74 },
  light: { x: 0.2, y: 2.75, z: 0.4 },
  doorSense: 1.5,
} as const;

// ---------------------------------------------------------------------------
// Tahap 4: Collaboration Commons (sisi UTARA Jalan Utama) & Digital Garden (selatan)
//
// Commons adalah ruangan pertama di sisi utara bus setelah foyer, dibangun cermin dari
// ruangan selatan (rooms/northWing.ts): dinding kaca berpintu di dunia Z 4.76..5.00 (garis kaca
// sementara bus), dinding utara solid di Z -1.0..-0.76. Ruang rapat & foyer tidak punya dinding
// timur (hanya curb cutaway), jadi Commons membangun dinding baratnya sendiri (X 15.0..15.24)
// dan dinding itu selalu memudar: dari kamera Tenggara ia menutupi ±4,4 m sisi timur ruang rapat.
// Dari kamera Tenggara dinding utara Commons tetap solid: benda tinggi ditaruh di sana.
// ---------------------------------------------------------------------------
export interface NorthRoomSpec {
  name: string;
  origin: Pt;
  halfX: number;
  halfZ: number;
  /** Bukaan pintu dinding selatan ke Jalan Utama (lokal). */
  southDoor: DoorSpan;
  /** Kusen pintu di dinding utara ke ruangan tahap berikutnya (lokal). */
  northDoors?: readonly DoorSpan[];
  /** X lokal pemecah dinding utara menjadi 2 ruas (Auto-Fade berbeda per ruas). */
  northSplitX?: number;
}

/** Z lokal titik berdiri di dalam ruangan utara tepat di depan pintu selatan (Commons: dunia Z 4.35). */
export const NORTH_ROOM_DOOR_INSIDE_Z = 2.35;

export const ROOM_COMMONS = {
  name: 'Room_CollabCommons',
  /** Bentang dunia X 15..25, Z -1..5 (10 × 6 m). */
  origin: { x: 20.0, z: 2.0 },
  halfX: 5.0,
  halfZ: 3.0,
  /** Bukaan terbuka 1,6 m di tengah, dunia X 19.2..20.8 (27 m tapak), segaris pintu Server. */
  southDoor: { xMin: -0.8, xMax: 0.8 },
  /**
   * Kusen pintu dinding utara: [0] ke calon Studio (dunia X 18, Tahap 6, daun tertutup, bukan jalur
   * navigasi) dan [1] ke Information Wall (dunia X 23, Tahap 5: bukaan terbuka + pelat ambang).
   */
  northDoors: [{ xMin: -2.5, xMax: -1.5 }, { xMin: 2.5, xMax: 3.5 }] as readonly DoorSpan[],
  /**
   * Tahap 5: dinding utara dipecah di dunia X 21 (lokal +1.0). Ruas barat (X 15..21) tetap dinding
   * perimeter solid (Studio belum dibangun); ruas timur (X 21..25) berbatasan dengan Information Wall
   * dan selalu memudar, karena dinding 3,2 m di Z -1 menutupi seluruh kedalaman baris utara dari kamera.
   */
  northSplitX: 1.0,
} as const satisfies NorthRoomSpec;

/** Commons (LOKAL terhadap pusat Room_CollabCommons). Lantai bersih X -4.76..4.76, Z -2.76..2.76. */
export const COMMONS = {
  /** Lorong cincin mengitari meja kolaborasi; pintu selatan tersambung tegak lurus ke sisi selatan. */
  ring: { minX: -2.45, maxX: 3.35, minZ: -1.55, maxZ: 1.8 },
  /** Meja kolaborasi modular 3,2 × 1,2 m (2 modul + spine daya/data), sisi panjang = X. */
  table: { x: 0.55, z: 0.12, length: 3.2, width: 1.2, top: 0.74 },
  /**
   * 6 kursi kerja (Office_Ergonomic_Chair.glb): 3 di utara (menghadap Selatan / kamera) dan 3 di
   * selatan (menghadap Utara). Agen duduk di titik kursi; berdiri dulu di lorong cincin.
   */
  seats: [
    ...[-0.5, 0.55, 1.6].map((x) => ({ spot: { x, z: -0.8, rotY: 0 }, approach: { x, z: -1.55 } })),
    ...[-0.5, 0.55, 1.6].map((x) => ({ spot: { x, z: 1.04, rotY: Math.PI }, approach: { x, z: 1.8 } })),
  ] as Array<{ spot: Spot; approach: Pt }>,
  sitY: 0.45,
  /**
   * Whiteboard kaca beroda (Office_Whiteboard_Scrum.glb 1,62 × 1,80). Tahap 6: dinding utara Commons kini
   * selalu memudar (Studio di baliknya), jadi whiteboard pindah ke sisi barat daya, menghadap Timur ke meja
   * kolaborasi (dunia (15.65, 3.65)); bayangan pandangnya jatuh di karpet kosong selatan ruang rapat.
   */
  whiteboard: { x: -4.35, z: 1.65, rotY: Math.PI / 2 },
  /**
   * Booth akustik setengah lingkaran (slot GLB `Office_Commons_Acoustic_Booth`: origin = pusat
   * lingkaran duduk di lantai, sisi terbuka +Z, R luar 0,95). Diputar 45° agar terbuka ke Tenggara.
   */
  booth: { x: -3.75, z: -1.75, rotY: Math.PI / 4, outerR: 0.95, backH: 1.25, seatH: 0.45 },
  plantNE: { x: 4.35, z: -2.35 },
  snakePlant: { x: -4.4, z: 0.2 },
  /** Lampu gantung linear (Office_Linear_Pendant_Light.glb 2,6 m) di atas meja. */
  pendant: { x: 0.55, z: 0.12 },
  /** Tulisan dinding (lebar 2,2 m) di ruas barat dinding utara (memudar bersama dindingnya sejak Tahap 6). */
  sign: { x: -0.25, y: 2.55, w: 2.2 },
} as const;

/** Digital Garden: sisi selatan bus, timur Server / IT. */
export const ROOM_GARDEN = {
  name: 'Room_DigitalGarden',
  /** Bentang dunia X 22..27, Z 7.4..13.4 (5 × 6 m). */
  origin: { x: 24.5, z: 10.4 },
  halfX: 2.5,
  halfZ: 3.0,
  /** Pintu kaca geser frameless 1,6 m, dunia X 23.7..25.3 (31,5 m tapak). */
  northDoor: { xMin: -0.8, xMax: 0.8 },
} as const satisfies SouthRoomSpec;

/**
 * Garden (LOKAL terhadap pusat Room_DigitalGarden). Lantai bersih X -2.5..2.26, Z -2.76..2.76.
 * Dinding barat = dinding timur Server (selalu memudar); green wall berdiri sendiri di depannya,
 * hanya separuh utara (dunia Z 7.9..10.9) supaya rak server tetap terlihat dari kamera Tenggara.
 */
export const GARDEN = {
  /** Lorong batu pijakan: pintu → selatan di X -0.55 → timur di depan bangku. */
  lane: [{ x: 0, z: -2.35 }, { x: 0, z: -1.55 }, { x: -0.55, z: -1.55 }, { x: -0.55, z: 1.5 }, { x: 1.75, z: 1.5 }] as Pt[],
  /**
   * Green wall (slot GLB `Office_Garden_Living_Wall` 3,0 × 2,4 × 0,15, origin belakang-bawah-tengah,
   * depan +Z), diputar 90°: menempel muka dinding barat, menghadap Timur.
   */
  livingWall: { x: -2.5, z: -1.0, rotY: Math.PI / 2, w: 3.0, h: 2.4, d: 0.15 },
  /** Fountain zen (slot GLB `Office_Garden_Zen_Fountain` 0,90 × 0,85 × 0,55, permukaan air 0,40). */
  fountain: { x: -2.15, z: 1.6, rotY: Math.PI / 2, w: 0.9, h: 0.85, d: 0.55, waterY: 0.4 },
  /** Bangku teak tanpa sandaran (slot GLB `Office_Garden_Teak_Bench` 1,80 × 0,45 × 0,42), menghadap Selatan. */
  bench: { x: 0.95, z: 0.92, rotY: 0, w: 1.8, d: 0.42, h: 0.45 },
  /** 3 titik duduk di bangku (menghadap Selatan, ke jendela panorama & kamera); berdiri dulu di depan bangku. */
  seats: [0.35, 0.95, 1.55].map((x) => ({ spot: { x, z: 0.92, rotY: 0 }, approach: { x, z: 1.5 } })) as Array<{ spot: Spot; approach: Pt }>,
  sitY: 0.35,
  /** Fiddle leaf fig (slot GLB `Office_Plant_Fiddle_Leaf_Fig`, tinggi 2,0, kanopi Ø0,8) di sudut timur laut. */
  fig: { x: 1.8, z: -2.2 },
  monstera: { x: 1.85, z: 2.3 },
  snakePlant: { x: 1.95, z: -0.5 },
  /** Jendela panorama palsu di muka dalam dinding selatan (ikut memudar). */
  window: { xMin: -2.1, xMax: 1.9, yMin: 0.45, yMax: 2.75 },
  light: { x: 0, y: 2.8, z: 0.4 },
  doorSense: 1.6,
} as const;

// ---------------------------------------------------------------------------
// Tahap 5: Workshop / Training (utara bus, timur Commons) + baris utara kedua (Z -5..-1):
// Information Wall (di atas Commons & Workshop) dan Collaboration Pods (di atas Workshop).
//
// Baris utara kedua tidak punya dinding selatan sendiri: dinding di dunia Z -1.0..-0.76 milik
// ruangan di selatannya (Commons ruas timur, Workshop), dan keduanya selalu memudar.
// ---------------------------------------------------------------------------
export const ROOM_WORKSHOP = {
  name: 'Room_WorkshopTraining',
  /** Bentang dunia X 25..31, Z -1..5 (6 × 6 m). Dinding barat = dinding kaca timur Commons. */
  origin: { x: 28.0, z: 2.0 },
  halfX: 3.0,
  halfZ: 3.0,
  /** Bukaan terbuka 1,6 m ke Jalan Utama, dunia X 27.2..28.8 (35 m tapak). */
  southDoor: { xMin: -0.8, xMax: 0.8 },
  /** Bukaan terbuka 1,2 m ke Collaboration Pods, dunia X 27.9..29.1 (35,5 m tapak). */
  northDoors: [{ xMin: -0.1, xMax: 1.1 }] as readonly DoorSpan[],
} as const satisfies NorthRoomSpec;

/** Ruangan baris utara kedua: pintu di dinding SELATAN milik ruangan di bawahnya (lokal X). */
export interface NorthTierSpec {
  name: string;
  origin: Pt;
  halfX: number;
  halfZ: number;
  southDoor: DoorSpan;
}

/** Z lokal titik berdiri di dalam ruangan baris utara kedua tepat di depan pintu selatan (dunia Z -1.45). */
export const NORTH_TIER_SOUTH_DOOR_INSIDE_Z = 1.55;

export const ROOM_INFOWALL = {
  name: 'Room_InfoWall',
  /** Bentang dunia X 21..26, Z -5..-1 (5 × 4 m). */
  origin: { x: 23.5, z: -3.0 },
  halfX: 2.5,
  halfZ: 2.0,
  /** = ROOM_COMMONS.northDoors[1], dunia X 22.5..23.5. */
  southDoor: { xMin: -1.0, xMax: 0.0 },
} as const satisfies NorthTierSpec;

export const ROOM_COLLABPODS = {
  name: 'Room_CollabPods',
  /** Bentang dunia X 26..31, Z -5..-1 (5 × 4 m). Dinding barat = dinding timur Information Wall. */
  origin: { x: 28.5, z: -3.0 },
  halfX: 2.5,
  halfZ: 2.0,
  /** = ROOM_WORKSHOP.northDoors[0], dunia X 27.9..29.1. */
  southDoor: { xMin: -0.6, xMax: 0.6 },
} as const satisfies NorthTierSpec;

/**
 * Workshop (LOKAL terhadap pusat Room_WorkshopTraining). Lantai bersih X -3.0..2.76, Z -2.76..2.76.
 * Panggung di sisi BARAT menghadap Timur (dinding utara, selatan, timur memudar dari kamera Tenggara).
 */
export const WORKSHOP = {
  /** Lorong cincin di antara 2 baris meja & koridor timur; cabang ke belakang podium (x < -1.8). */
  ring: { minX: -0.22, maxX: 1.85, minZ: -1.95, maxZ: 2.05 },
  stageBranch: [{ x: -0.22, z: 2.05 }, { x: -2.55, z: 2.05 }, { x: -2.55, z: 1.38 }] as Pt[],
  /** Panel latar kisi walnut berdiri sendiri (Z -1.30..1.70, tinggi 2,3) di depan kaca Commons. */
  backdrop: { x: -2.92, z: 0.2, w: 3.0, h: 2.3, t: 0.06 },
  /** Layar 85" (Office_Presentation_Display_85.glb, skala 0,88), menghadap Timur. */
  display: { x: -2.86, y: 1.46, z: 0.2, scale: 0.88 },
  /** Podium (slot GLB `Office_Workshop_Lectern_Podium` 0,62 × 1,12 × 0,48; pembaca di −Z, audiens +Z). */
  podium: { x: -2.12, z: 1.38, rotY: Math.PI / 2, w: 0.62, h: 1.12, d: 0.48 },
  /** Titik berdiri pembicara di belakang podium, menghadap Timur (sitY 0: approach = spot). */
  presenter: { x: -2.55, z: 1.38, rotY: Math.PI / 2 } as Spot,
  /**
   * 2 meja pelatihan (slot GLB `Office_Workshop_Training_Table` 1,80 × 0,74 × 0,55; modesty panel di −Z,
   * kursi di +Z). rotY +90° (BUKAN −90°): sisi kursi (+Z GLB) menghadap Timur, ke peserta.
   */
  tables: [{ x: -1.3, z: 0.2 }, { x: 0.5, z: 0.2 }] as Pt[],
  table: { rotY: Math.PI / 2, w: 1.8, d: 0.55, h: 0.74 },
  /** 6 kursi peserta menghadap Barat (ke panggung); baris depan berdiri dulu di x -0.22, belakang di x 1.85. */
  seats: [
    ...[-0.38, 0.2, 0.78].map((z) => ({ spot: { x: -0.78, z, rotY: -Math.PI / 2 }, approach: { x: -0.22, z } })),
    ...[-0.38, 0.2, 0.78].map((z) => ({ spot: { x: 1.02, z, rotY: -Math.PI / 2 }, approach: { x: 1.85, z } })),
  ] as Array<{ spot: Spot; approach: Pt }>,
  sitY: 0.45,
  pendant: { x: -0.4, z: 0.2, rotY: Math.PI / 2 },
  /** Monstera di ujung utara panel panggung (di pojok barat laut ia berdempetan dengan monstera Commons di balik kaca). */
  plantNW: { x: -2.5, z: -1.75 },
  snakeSE: { x: 2.3, z: 2.25 },
} as const;

/**
 * Information Wall (LOKAL terhadap pusat Room_InfoWall). Lantai bersih X -2.26..2.26, Z -1.76..2.0.
 * Dinding utara (perimeter) & barat (ke tapak Studio) tetap solid; dinding timur selalu memudar.
 */
export const INFOWALL = {
  laneZ: 0.65,
  /**
   * Layar komando (slot GLB `Office_InfoWall_Command_Display` 3,80 × 2,10 × 0,30, origin tengah sisi
   * BELAKANG di lantai, layar +Z). Mesh layar aktif `Command_Screen_Active` (X ±1,80, Y 0,65..2,02,
   * muka di z 0,155) ditimpa kanvas live scene.
   */
  display: { x: 0.1, z: -1.76, w: 3.8, h: 2.1, d: 0.3, screen: { w: 3.6, yMin: 0.65, yMax: 2.02, z: 0.155 } },
  /** Papan kanban (slot GLB `Office_InfoWall_Kanban_Board` 1,80 × 1,15 × 0,06, origin tengah belakang). */
  kanban: { x: -2.25, y: 1.55, z: -0.05, rotY: Math.PI / 2, w: 1.8, h: 1.15, d: 0.06 },
  /** 3 titik berdiri pengamat menghadap layar (Utara), 1,6 m dari muka layar. */
  observers: [{ x: -1.05, z: 0.15, rotY: Math.PI }, { x: 0.1, z: 0.15, rotY: Math.PI }, { x: 1.25, z: 0.15, rotY: Math.PI }] as Spot[],
  /** Snake plant (digeser dari (1.90, -1.38): di sana pot bertumpuk ujung konsol layar). */
  snakePlant: { x: 2.0, z: -0.95 },
  light: { x: 0.1, y: 2.6, z: 0.2 },
} as const;

/** Collaboration Pods (LOKAL terhadap pusat Room_CollabPods). Lantai bersih X -2.5..2.26, Z -1.76..2.0. */
export const COLLABPODS = {
  laneZ: 0.6,
  /**
   * 2 diner pod (slot GLB `Office_Collab_Diner_Pod` 1,90 × 1,32 × 1,30; punggung −Z, terbuka +Z, bangku di
   * x ±0,71 dudukan 0,45, meja tengah 0,52 × 1,10 tinggi 0,72). Lampu okupansi milik scene di atas punggung.
   */
  pods: [{ x: -1.38, z: -0.98 }, { x: 1.14, z: -0.98 }] as Pt[],
  pod: { w: 1.9, h: 1.32, d: 1.3, benchX: 0.71, seatH: 0.45, tableW: 0.52, tableD: 1.1, tableH: 0.72 },
  /** Agen duduk 0,62 m dari sumbu pod, saling berhadapan; berdiri dulu 0,45 m di depan bibir pod. */
  seatOffsetX: 0.62,
  approachZ: 0.12,
  /** Dudukan 0,45 → avatar di y 0,35 (sama dengan sofa Lounge & bangku Garden). */
  sitY: 0.35,
  snakePlant: { x: -0.12, z: -1.3 },
  light: { x: 0, y: 2.6, z: -0.3 },
} as const;

// ---------------------------------------------------------------------------
// Tahap 6 (penutup Lantai 1): Studio / Content (baris utara kedua, X 15..21), Focus Pods (selatan,
// X 14..18, di antara Lounge & Server) dan Digital Access Hub (selatan, X 27..31, timur Garden).
// ---------------------------------------------------------------------------
export const ROOM_STUDIO = {
  name: 'Room_StudioContent',
  /** Bentang dunia X 15..21, Z -5..-1 (6 × 4 m). Dinding timur = dinding barat Information Wall. */
  origin: { x: 18.0, z: -3.0 },
  halfX: 3.0,
  halfZ: 2.0,
  /** = ROOM_COMMONS.northDoors[0], dunia X 17.5..18.5. */
  southDoor: { xMin: -0.5, xMax: 0.5 },
} as const satisfies NorthTierSpec;

export const ROOM_FOCUS = {
  name: 'Room_FocusPods',
  /** Bentang dunia X 14..18, Z 7.4..13.4 (4 × 6 m). Barat = dinding timur Lounge, timur = dinding barat Server. */
  origin: { x: 16.0, z: 10.4 },
  halfX: 2.0,
  halfZ: 3.0,
  /** Pintu kaca geser otomatis 1,4 m, dunia X 15.3..16.7 (23 m tapak). */
  northDoor: { xMin: -0.7, xMax: 0.7 },
} as const satisfies SouthRoomSpec;

export const ROOM_ACCESS = {
  name: 'Room_AccessHub',
  /** Bentang dunia X 27..31, Z 7.4..13.4 (4 × 6 m). Barat = dinding timur Garden. */
  origin: { x: 29.0, z: 10.4 },
  halfX: 2.0,
  halfZ: 3.0,
  /** Pintu kaca geser ganda otomatis 1,6 m, dunia X 28.2..29.8 (36 m tapak). */
  northDoor: { xMin: -0.8, xMax: 0.8 },
} as const satisfies SouthRoomSpec;

/**
 * Studio (LOKAL terhadap pusat Room_StudioContent). Lantai bersih X -2.76..3.0, Z -1.76..2.0.
 * Dinding utara (perimeter) tetap solid; barat (ke ruang rapat) & timur (InfoWall) selalu memudar.
 */
export const STUDIO = {
  /**
   * Lorong polyline: koridor selatan z 1.45 (pintu & sutradara) → lorong tengah x 0.42 (0,37 m timur
   * green screen, 0,6 m barat meja produksi) → tanda talent. Editor menyambung lurus dari lorong tengah.
   */
  lane: [{ x: -1.25, z: 1.45 }, { x: 0.42, z: 1.45 }, { x: 0.42, z: -0.72 }, { x: -1.25, z: -0.72 }] as Pt[],
  /** Panggung cyclorama green screen (slot GLB `Office_Studio_Cyclorama_Stage` 2,60 × 2,35 × 1,75, origin belakang). */
  cyclorama: { x: -1.25, z: -1.76, w: 2.6, h: 2.35, d: 1.75 },
  /** Tanda "✕" talent di atas lantai lengkung (berdiri, menghadap Selatan). */
  talent: { x: -1.25, z: -0.72, rotY: 0 } as Spot,
  /** Rig kamera sinema + softbox (slot GLB `Office_Studio_Camera_Softbox_Rig` 1,30 × 1,68 × 0,80), menghadap Utara. */
  rig: { x: -1.25, z: 0.52, rotY: Math.PI, w: 1.3, h: 1.68, d: 0.8 },
  /** Sutradara / kameramen berdiri di belakang kamera, menghadap Utara. */
  director: { x: -1.25, z: 1.35, rotY: Math.PI } as Spot,
  /** Meja produksi & color-grading (slot GLB `Office_Studio_Production_Desk` 1,65 × 1,18 × 0,72, origin belakang). */
  desk: { x: 1.85, z: -1.76, w: 1.65, h: 1.18, d: 0.72, top: 0.75 },
  /** Kursi editor 0,32 m dari tepi meja (sama dengan kursi Commons; rencana z -0.58 = 0,46 m, tangan tak sampai keyboard). */
  editor: { spot: { x: 1.85, z: -0.72, rotY: Math.PI } as Spot, approach: { x: 1.85, z: 0.05 } as Pt },
  sitY: 0.45,
  snakePlant: { x: 2.58, z: 1.55 },
  lightShoot: { x: -1.25, y: 2.55, z: -0.2 },
  lightEdit: { x: 1.85, y: 2.5, z: -0.6 },
  /** Lampu "ON AIR" di dinding utara (solid) di antara green screen & meja produksi. */
  onAir: { x: 0.55, y: 2.45 },
} as const;

/** Focus Pods (LOKAL terhadap pusat Room_FocusPods). Lantai bersih X -2.0..2.0, Z -2.76..2.76. */
export const FOCUSPODS = {
  /** Lorong L: pintu → koridor timur x 0.85; titik berdiri tiap bilik disambung lurus ke Barat. */
  lane: [{ x: 0, z: -2.35 }, { x: 0.85, z: -2.35 }, { x: 0.85, z: 2.19 }] as Pt[],
  /**
   * 2 bilik fokus tunggal (slot GLB `Office_Focus_Solo_Pod` 1,36 × 1,48 × 1,16; meja & monitor di −Z, terbuka
   * di +Z, tanpa atap) di sisi barat, diputar 45°: mulut menghadap Tenggara, searah kamera isometrik.
   * Koreksi rencana (rotY +90°, mulut ke Timur): dari kamera Tenggara (elevasi ±26°, azimut ±42°) sirip depan
   * & brow bilik menutupi agen yang duduk; mulut ke Selatan pun sama. Hanya mulut serong 45° yang memperlihatkan
   * agen yang mengetik & monitor 34"-nya.
   */
  pods: [{ x: -1.05, z: -1.0 }, { x: -1.05, z: 1.3 }] as Pt[],
  pod: { w: 1.36, h: 1.48, d: 1.16, rotY: Math.PI / 4 },
  /** Dudukan GLB di lokal (0, +0.18) menghadap −Z (ke meja); berdiri dulu 0,36 m di depan mulut bilik. */
  seatDZ: 0.18,
  approachDZ: 0.94,
  sitY: 0.35,
  plants: [{ x: -1.72, z: 0.22 }, { x: 1.55, z: 2.3 }] as Pt[],
  /** Papan "QUIET ZONE" di muka timur dinding barat (= dinding timur Lounge), di atas celah antar-bilik. */
  sign: { x: -1.98, y: 2.15, z: 0.15 },
  light: { x: 0.3, y: 2.6, z: 0.25 },
  doorSense: 1.6,
} as const;

/** Digital Access Hub (LOKAL terhadap pusat Room_AccessHub). Lantai bersih X -2.0..1.76, Z -2.76..2.76. */
export const ACCESS = {
  lane: [{ x: 0, z: -2.35 }, { x: 0, z: -1.1 }, { x: -0.25, z: 1.25 }] as Pt[],
  /** Portal lift Lantai 2 (slot GLB `Office_Access_Elevator_Portal` 1,70 × 2,45 × 0,28, origin belakang), menghadap Timur. */
  lift: { x: -2.0, z: -1.1, rotY: Math.PI / 2, w: 1.7, h: 2.45, d: 0.28 },
  liftSpot: { x: -1.05, z: -1.1, rotY: -Math.PI / 2 } as Spot,
  /**
   * Totem peta gedung (slot GLB `Office_Access_Floor_Map_Totem` 0,95 × 1,25 × 0,55); layar miring 30° bernama
   * `Access_Map_Screen` (0,82 × 0,48, pusat lokal (0, 1.04, 0.02)) ditimpa kanvas peta scene.
   */
  totem: { x: -1.42, z: 1.25, rotY: Math.PI / 2, w: 0.95, h: 1.25, d: 0.55 },
  mapSpot: { x: -0.62, z: 1.25, rotY: -Math.PI / 2 } as Spot,
  /**
   * Tangga melayang ke mezzanine Lantai 2 (slot GLB `Office_Access_Floor2_Staircase` 1,25 × 2,35 × 2,20; naik dari
   * −Z lokal ke bordes +Z lokal, bordes 1,52). Koreksi rencana (kuadran tenggara, rotY 0): bordes setinggi 2,35 m
   * menutupi agen pembaca totem dari kamera Tenggara. Kini di kuadran timur laut, diputar 180°: anak tangga pertama
   * di selatan (z −0.16), bordes & gerbang "Lantai 2" di utara menghadap kamera; tidak menutupi lift, totem, maupun Garden.
   */
  stairs: { x: 1.02, z: -1.2, rotY: Math.PI, w: 1.25, h: 2.35, d: 2.2, landing: 1.52 },
  monstera: { x: 1.3, z: 2.25 },
  ring: { x: 0, y: 2.85, z: -0.4 },
  doorSense: 1.6,
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
