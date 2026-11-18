import * as THREE from 'three';
import { COMMONS, ROOM_COMMONS, type Spot } from '../layout';
import type { WallFader } from '../camera/wallFade';
import {
  box,
  canvasTexture,
  enableShadow,
  lightAnchor,
  meterBox,
  type ModelLoader,
  mountAsset,
  std,
} from './assets';
import { buildNorthRoomShell } from './northWing';
import { boardroomWallMats, glassWallMats } from './walls';

/**
 * LAYER RUANGAN TAHAP 4: Room_CollabCommons, pusat dunia (20.0, 2.0), 10 × 6 m, sisi UTARA bus.
 *
 * Ruang kerja kelompok terbuka: meja kolaborasi modular + 6 kursi kerja, whiteboard beroda,
 * booth akustik setengah lingkaran, lampu gantung linear.
 * - Selatan: kaca + bukaan terbuka 1,6 m ke Jalan Utama (selalu memudar, dinding sisi bus).
 * - Utara  : ruas barat X 15..21 (tulisan dinding, pintu terbuka ke Studio / Content, Tahap 6) dan ruas
 *            timur X 21..25 (pintu terbuka ke Information Wall, Tahap 5). Keduanya dinding dalam ke baris
 *            utara kedua → selalu memudar di tampilan rumah boneka.
 * - Barat  : partisi akustik baru di sisi timur ruang rapat & foyer (selalu memudar).
 * - Timur  : kaca ke calon Workshop / Training (Tahap 5, selalu memudar).
 */
export interface CollabCommons {
  group: THREE.Group;
  bindWalls: () => void;
  /** Kursi meja kolaborasi (dunia): titik duduk + titik berdiri di lorong cincin. */
  seatsWorld: () => Array<{ spot: Spot; approach: Spot }>;
  focusPoint: () => THREE.Vector3;
}

export function buildCollabCommons(load: ModelLoader, fader: WallFader): CollabCommons {
  const shell = buildNorthRoomShell({
    spec: ROOM_COMMONS,
    fader,
    fadeId: 'commons',
    glass: glassWallMats(),
    sideMats: { west: boardroomWallMats() },
    sideKind: { east: 'glass' },
    interiorSides: ['west', 'east'],
    // Tahap 6: kedua ruas berbatasan dengan baris utara kedua (Studio | Information Wall) → selalu
    // memudar, pintunya terbuka + ambang. Ruas tetap dipisah di X 21 (id fader lama tetap berlaku).
    northSegments: [
      { id: 'north_west', xMin: -ROOM_COMMONS.halfX, xMax: ROOM_COMMONS.northSplitX, interior: true, doors: [ROOM_COMMONS.northDoors[0]!], openDoors: true },
      { id: 'north_east', xMin: ROOM_COMMONS.northSplitX, xMax: ROOM_COMMONS.halfX, interior: true, doors: [ROOM_COMMONS.northDoors[1]!], openDoors: true },
    ],
  });
  const { group, sub, inner } = shell;
  const northWest = shell.northSegments.north_west!;
  const floor = sub('SubLayer_Floor');
  const furniture = sub('SubLayer_Furniture');
  const decor = sub('SubLayer_Decor');

  const slot = (parent: THREE.Group, name: string, x: number, y: number, z: number, rotY = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  };

  // ---- Karpet akustik abu-abu bermotif geometris + list kayu oak hangat di tepi ----
  {
    const W = inner.maxX - inner.minX, D = inner.maxZ - inner.minZ, b = 0.12;
    const cx = (inner.minX + inner.maxX) / 2;
    floor.add(meterBox(W - 2 * b, 0.02, D - 2 * b, geometricCarpetMaterial(), [cx, -0.01, 0], 'Commons_Acoustic_Carpet'));
    const oak = oakMaterial();
    const strip = (w: number, d: number, x: number, z: number, n: string) => floor.add(meterBox(w, 0.02, d, oak, [x, -0.01, z], n));
    strip(W, b, cx, inner.minZ + b / 2, 'Oak_Border_N');
    strip(W, b, cx, inner.maxZ - b / 2, 'Oak_Border_S');
    strip(b, D - 2 * b, inner.minX + b / 2, 0, 'Oak_Border_W');
    strip(b, D - 2 * b, inner.maxX - b / 2, 0, 'Oak_Border_E');
  }

  // ---- Tulisan dinding di ruas barat dinding utara (ikut memudar bersama dindingnya) ----
  {
    const s = COMMONS.sign;
    const title = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.w * 0.154), new THREE.MeshBasicMaterial({ map: wallTitleTexture(), transparent: true, toneMapped: false, depthWrite: false }));
    title.name = 'Wall_Title_Collaboration_Commons';
    // Dinding memudar di tampilan rumah boneka: tulisan hilang penuh agar tidak menimpa green screen Studio.
    title.userData.fadeHide = true;
    title.position.set(s.x, s.y, inner.minZ + 0.006);
    northWest.add(title);
  }

  // ---- Meja kolaborasi modular + 6 kursi kerja + laptop ----
  {
    const t = COMMONS.table;
    mountAsset(slot(furniture, 'Collab_Table_Modular', t.x, 0, t.z), '/models/Office_Commons_Collab_Table.glb', collabTablePlaceholder(t.length, t.width, t.top), load);
    COMMONS.seats.forEach((s, i) => {
      mountAsset(slot(furniture, `Commons_Task_Chair_${i}`, s.spot.x, 0, s.spot.z, s.spot.rotY), '/models/Office_Ergonomic_Chair.glb', new THREE.Group(), load);
    });
    // Laptop & buku catatan (props scene, bukan bagian GLB meja)
    const props = slot(furniture, 'Collab_Table_Props', t.x, t.top, t.z);
    COMMONS.seats.forEach((s, i) => {
      const lx = s.spot.x - t.x, lz = (s.spot.z < t.z ? -1 : 1) * 0.3;
      if (i % 3 === 1 && s.spot.z > t.z) {
        props.add(box(0.21, 0.012, 0.28, std([0xe8e2d4, 0x1f4d55][i % 2]!, 0.8, 0), [lx + 0.1, 0.006, lz], 'Notebook'));
        return;
      }
      // Laptop lokal: pengguna di sisi +Z. Kursi utara (z < meja) → diputar 180°.
      props.add(laptop(s.spot.z < t.z ? Math.PI : 0, lx, lz, i));
    });
  }

  // ---- Whiteboard kaca beroda (pakai ulang Office_Whiteboard_Scrum.glb) ----
  {
    const w = COMMONS.whiteboard;
    mountAsset(slot(furniture, 'Ideation_Whiteboard', w.x, 0, w.z, w.rotY), '/models/Office_Whiteboard_Scrum.glb', new THREE.Group(), load);
  }

  // ---- Booth akustik setengah lingkaran + meja laptop kecil ----
  {
    const b = COMMONS.booth;
    mountAsset(slot(furniture, 'Acoustic_Booth', b.x, 0, b.z, b.rotY), '/models/Office_Commons_Acoustic_Booth.glb', boothPlaceholder(b.outerR, b.backH, b.seatH), load);
  }

  // ---- Lampu gantung linear + cahaya hangat di atas meja ----
  {
    const p = COMMONS.pendant;
    mountAsset(slot(decor, 'Linear_Pendant_Commons', p.x, 0, p.z), '/models/Office_Linear_Pendant_Light.glb', new THREE.Group(), load);
    [-0.85, 0.85].forEach((dx, i) => {
      const l = lightAnchor(0xffe0bd, 9, 5, 1.7);
      l.name = `Commons_Table_Light_${i}`;
      l.position.set(p.x + dx, 2.15, p.z);
      decor.add(l);
    });
    const fill = lightAnchor(0xe8f0ff, 7, 7, 1.6);
    fill.name = 'Commons_Fill_Light';
    fill.position.set(-2.8, 2.7, -1.0);
    decor.add(fill);
  }

  // ---- Tanaman ----
  {
    const ne = slot(decor, 'Commons_Plant_NE', COMMONS.plantNE.x, 0, COMMONS.plantNE.z);
    mountAsset(ne, '/models/Office_Indoor_Plant.glb', new THREE.Group(), load);
    const sn = slot(decor, 'Commons_SnakePlant', COMMONS.snakePlant.x, 0, COMMONS.snakePlant.z);
    sn.scale.setScalar(0.95);
    mountAsset(sn, '/models/Office_Indoor_Plant_SnakePlant.glb', new THREE.Group(), load);
  }

  const toWorldSpot = (p: { x: number; z: number }, rotY = 0): Spot => {
    const v = shell.local(p.x, 0, p.z);
    return { x: v.x, z: v.z, rotY };
  };

  return {
    group,
    bindWalls: shell.bindWalls,
    seatsWorld: () => COMMONS.seats.map((s) => ({ spot: toWorldSpot(s.spot, s.spot.rotY), approach: toWorldSpot(s.approach, s.spot.rotY) })),
    focusPoint: () => shell.local(0.2, 1.05, 0.1),
  };
}

// ============================================================================
// Tekstur prosedural
// ============================================================================
function rnd(seed: number) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

/** Karpet akustik abu-abu: motif segitiga geometris halus, canvas = 1 m. */
function geometricCarpetMaterial() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!, img = x.createImageData(S, S), d = img.data, r = rnd(41);
  for (let i = 0; i < S * S; i++) {
    const v = 0.92 + r() * 0.1;
    d[i * 4] = 92 * v; d[i * 4 + 1] = 97 * v; d[i * 4 + 2] = 102 * v; d[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  x.strokeStyle = 'rgba(150,156,162,0.55)'; x.lineWidth = 2;
  const h = S / 4;
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const ox = col * h, oy = row * h;
    x.beginPath();
    if ((row + col) % 2) { x.moveTo(ox, oy); x.lineTo(ox + h, oy + h); } else { x.moveTo(ox + h, oy); x.lineTo(ox, oy + h); }
    x.stroke();
  }
  x.fillStyle = 'rgba(64,68,72,0.35)';
  for (let k = 0; k < 6; k++) { const px = (k * 97) % S, py = (k * 61) % S; x.beginPath(); x.moveTo(px, py); x.lineTo(px + h / 2, py); x.lineTo(px, py + h / 2); x.fill(); }
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.96, 0, { map: tex });
}

/** Kayu oak hangat (list lantai, daun pintu): serat memanjang, canvas = 1 m. */
function oakMaterial(roughness = 0.55) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#b88a5a'; x.fillRect(0, 0, S, S);
  const r = rnd(73);
  for (let i = 0; i < 160; i++) {
    x.strokeStyle = r() > 0.5 ? 'rgba(120,80,44,0.18)' : 'rgba(225,190,140,0.14)';
    x.lineWidth = 0.5 + r() * 1.5;
    const y = r() * S;
    x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 6, S * 0.7, y + (r() - 0.5) * 6, S, y); x.stroke();
  }
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, roughness, 0.03, { map: tex });
}

/** Tulisan dinding "COLLABORATION COMMONS" (huruf terang, latar transparan). */
function wallTitleTexture() {
  const c = document.createElement('canvas'); c.width = 1300; c.height = 200;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 1300, 200);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#e8edf2'; x.font = '800 92px "Inter", "Segoe UI", system-ui, sans-serif';
  x.fillText('COLLABORATION COMMONS', 650, 86);
  x.fillStyle = '#5ed9e7'; x.font = '500 34px "Inter", "Segoe UI", system-ui, sans-serif';
  x.fillText('diskusi lintas tim · desain · kode · QA', 650, 162);
  return canvasTexture(c);
}

// ============================================================================
// Placeholder prosedural (otomatis diganti GLB bila file-nya ada di public/models)
// ============================================================================
/**
 * Meja kolaborasi modular, kontrak GLB `Office_Commons_Collab_Table`: 3,20 (X) × 0,74 × 1,20 (Z),
 * origin lantai tengah. 2 modul 1,6 m, top laminasi oak putih, kaki trestle baja hitam matte,
 * spine daya & data di tengah sepanjang X (tanpa laptop: props dipasang scene).
 */
function collabTablePlaceholder(len: number, wid: number, top: number) {
  const g = new THREE.Group();
  g.name = 'Collab_Table_Placeholder';
  const laminate = std(0xe9e3d8, 0.45, 0.02);
  const steel = std(0x17191c, 0.5, 0.75);
  [-len / 4, len / 4].forEach((x, i) => g.add(box(len / 2 - 0.006, 0.03, wid, laminate, [x, top - 0.015, 0], `Top_Module_${i}`)));
  for (const x of [-len / 2 + 0.12, 0, len / 2 - 0.12]) {
    g.add(box(0.06, top - 0.03, 0.06, steel, [x, (top - 0.03) / 2, 0], 'Trestle_Post'));
    g.add(box(0.06, 0.04, wid - 0.16, steel, [x, 0.02, 0], 'Trestle_Foot'));
    g.add(box(0.06, 0.04, wid - 0.2, steel, [x, top - 0.05, 0], 'Trestle_Head'));
  }
  g.add(box(len - 0.3, 0.05, 0.05, steel, [0, 0.35, 0], 'Stretcher'));
  // Spine daya & data: rel hitam + soket putih/biru
  g.add(box(len - 0.4, 0.035, 0.12, std(0x1d2024, 0.4, 0.6), [0, top + 0.0175, 0], 'Power_Data_Spine'));
  for (let k = 0; k < 8; k++) {
    const x = -len / 2 + 0.4 + k * (len - 0.8) / 7;
    g.add(box(0.04, 0.006, 0.03, std(k % 2 ? 0x3b82f6 : 0xf1f5f9, 0.4, 0.1), [x, top + 0.037, 0.035], 'Port'));
    g.add(box(0.04, 0.006, 0.03, std(k % 2 ? 0xf1f5f9 : 0x3b82f6, 0.4, 0.1), [x, top + 0.037, -0.035], 'Port'));
  }
  enableShadow(g);
  return g;
}

/** Laptop terbuka (layar menghadap pengguna di sisi kursi). */
function laptop(yaw: number, x: number, z: number, i: number) {
  const g = new THREE.Group();
  g.name = 'Laptop';
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const alu = std(0xb7bcc2, 0.3, 0.85);
  g.add(box(0.32, 0.014, 0.22, alu, [0, 0.007, 0], 'Laptop_Base'));
  const lid = new THREE.Group();
  lid.position.set(0, 0.014, -0.11);
  lid.rotation.x = -0.32;
  lid.add(box(0.32, 0.21, 0.008, alu, [0, 0.105, 0], 'Laptop_Lid'));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.18), new THREE.MeshBasicMaterial({ color: [0x1d4f6a, 0x2d5a3d, 0x4a3d6a][i % 3]! }));
  screen.position.set(0, 0.105, 0.0045);
  lid.add(screen);
  g.add(lid);
  enableShadow(g);
  return g;
}

/**
 * Booth akustik setengah lingkaran, kontrak GLB `Office_Commons_Acoustic_Booth`: origin = pusat
 * lingkaran duduk di lantai, sisi terbuka +Z. Sandaran felt R 0,80..0,95 setinggi `backH`,
 * dudukan R 0,42..0,80 setinggi `seatH`, meja laptop bundar Ø0,50 (0,62 m) di tengah.
 */
function boothPlaceholder(R: number, backH: number, seatH: number) {
  const g = new THREE.Group();
  g.name = 'Acoustic_Booth_Placeholder';
  // Sektor cincin di setengah belakang (z < 0): shape (x, y) → rotateX(π/2) → (x, z).
  const ring = (r0: number, r1: number, y0: number, y1: number, mat: THREE.Material, name: string) => {
    const s = new THREE.Shape();
    s.absarc(0, 0, r1, Math.PI, Math.PI * 2, false);
    s.absarc(0, 0, r0, Math.PI * 2, Math.PI, true);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 28 });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, y1, 0);
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    g.add(m);
  };
  ring(R - 0.15, R, 0, backH, std(0x4d6b63, 0.95, 0), 'Felt_Back_Shell');
  ring(R - 0.15, R, backH, backH + 0.02, std(0xb88a5a, 0.5, 0.03), 'Oak_Back_Cap');
  ring(0.42, R - 0.15, 0, seatH - 0.1, std(0x2f3a38, 0.9, 0), 'Seat_Base');
  ring(0.43, R - 0.16, seatH - 0.1, seatH, std(0x7c9a8e, 0.9, 0), 'Seat_Cushion');
  ring(R - 0.2, R - 0.15, seatH, seatH + 0.42, std(0x6d8a7f, 0.92, 0), 'Back_Cushion');
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.025, 32), std(0xe9e3d8, 0.45, 0.02));
  top.position.y = 0.6075;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 12), std(0x17191c, 0.5, 0.75));
  post.position.y = 0.3;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 24), std(0x17191c, 0.5, 0.75));
  foot.position.y = 0.0075;
  g.add(top, post, foot);
  enableShadow(g);
  return g;
}
