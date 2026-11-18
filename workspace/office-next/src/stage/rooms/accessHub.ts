import * as THREE from 'three';
import { ACCESS, ROOM_ACCESS, type Pt, type Spot } from '../layout';
import type { WallFader } from '../camera/wallFade';
import {
  box,
  canvasTexture,
  enableShadow,
  meterBox,
  mountAsset,
  std,
  type ModelLoader,
} from './assets';
import { slidingGlassDoor } from './doors';
import { buildSouthRoomShell } from './southWing';
import { glassWallMats } from './walls';

/**
 * LAYER RUANGAN TAHAP 6: Room_AccessHub, pusat dunia (29.0, 10.4), 4 × 6 m, sudut tenggara gedung.
 *
 * Gerbang vertikal gedung: portal lift Lantai 2, totem peta gedung interaktif (layar miring 30° dengan
 * kanvas peta 16 zona + kehadiran agen), tangga melayang ke mezzanine Lantai 2 (gerbang "Segera").
 * - Utara : kaca + pintu kaca geser ganda otomatis 1,6 m ke Jalan Utama (selalu memudar).
 * - Barat : dinding timur Digital Garden (milik Garden, selalu memudar). Benda tinggi hanya di separuh
 *           utara (lift); separuh selatan totem rendah ≤ 1,25 m agar bangku Garden tetap terlihat.
 * - Timur & Selatan: dinding luar gedung (memudar dari kamera Tenggara).
 */
export interface AccessHub {
  group: THREE.Group;
  bindWalls: () => void;
  /** Titik tugas (dunia): pembaca peta di depan totem & penunggu lift. */
  spotsWorld: () => { map: Spot; lift: Spot };
  /** Peta totem: jumlah agen per ruangan (id navigasi) + mode live/simulasi. */
  setMap: (rooms: Record<string, number>, live: boolean) => void;
  /** Tombol panggil lift menyala saat ada agen menunggu. */
  setLiftCalled: (on: boolean) => void;
  update: (dt: number, agents: readonly Pt[]) => void;
  focusPoint: () => THREE.Vector3;
}

export function buildAccessHub(load: ModelLoader, fader: WallFader): AccessHub {
  const shell = buildSouthRoomShell({
    spec: ROOM_ACCESS,
    fader,
    fadeId: 'access',
    glass: glassWallMats(),
    interiorSides: [],
    sides: { west: false },
  });
  const { group, sub, inner } = shell;
  const floor = sub('SubLayer_Floor');
  const features = sub('SubLayer_Vertical_Access');
  const decor = sub('SubLayer_Decor');
  const slot = (parent: THREE.Object3D, name: string, x: number, y: number, z: number, rotY = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  };

  // ---- Lantai teraso terang + garis pandu kuningan (ke lift) & cyan (ke tangga) ----
  {
    const W = inner.maxX - inner.minX, D = inner.maxZ - inner.minZ;
    floor.add(meterBox(W, 0.02, D, terrazzo(), [(inner.minX + inner.maxX) / 2, -0.01, (inner.minZ + inner.maxZ) / 2], 'Access_Terrazzo_Floor'));
    const brass = std(0xb39362, 0.3, 0.86);
    const cyan = new THREE.MeshBasicMaterial({ color: 0x5ed9e7 });
    const strip = (mat: THREE.Material, w: number, d: number, x: number, z: number, n: string) => {
      const m = box(w, 0.003, d, mat, [x, 0.0015, z], n);
      m.castShadow = false;
      floor.add(m);
    };
    strip(brass, 0.025, 1.2, -0.15, -2.0, 'Guide_Brass_Entry');
    strip(brass, 1.0, 0.025, -0.65, -1.4, 'Guide_Brass_Lift');
    strip(cyan, 0.85, 0.02, 0.6, 0.12, 'Guide_Cyan_Stairs');
  }

  // ---- Portal lift Lantai 2 (rata dinding barat, menghadap Timur) ----
  const callMat = std(0x0b2530, 0.3, 0.2, { emissive: 0x22d3ee, emissiveIntensity: 0.25 });
  {
    const l = ACCESS.lift;
    mountAsset(slot(features, 'Elevator_Portal', l.x, 0, l.z, l.rotY), '/models/Office_Access_Elevator_Portal.glb', elevatorPlaceholder(l.w, l.h, l.d, callMat), load);
  }

  // ---- Totem peta gedung + overlay kanvas live di layar miring ----
  const map = new FloorMapScreen();
  {
    const t = ACCESS.totem;
    const mount = slot(features, 'Floor_Map_Totem', t.x, 0, t.z, t.rotY);
    map.mesh.position.set(0, 1.04, 0.02);
    map.mesh.rotation.x = -Math.PI / 6;
    map.mesh.translateZ(0.004);
    mount.add(map.mesh);
    mountAsset(slot(mount, 'Totem_Model', 0, 0, 0), '/models/Office_Access_Floor_Map_Totem.glb', totemPlaceholder(t.w, t.h, t.d), load, (model) => {
      // Layar miring: salin transform mesh `Access_Map_Screen` relatif ke mount, lalu geser 4 mm searah normalnya.
      const screen = model.getObjectByName('Access_Map_Screen') as THREE.Mesh | undefined;
      if (!screen?.isMesh) return;
      mount.updateWorldMatrix(true, true);
      const geo = screen.geometry;
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const c = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3());
      if (size.x < 0.1 || size.y < 0.1) return;
      const m = new THREE.Matrix4().copy(mount.matrixWorld).invert().multiply(screen.matrixWorld)
        .multiply(new THREE.Matrix4().makeTranslation(c.x, c.y, bb.max.z + 0.004));
      m.decompose(map.mesh.position, map.mesh.quaternion, map.mesh.scale);
      map.mesh.scale.x *= size.x / 0.82;
      map.mesh.scale.y *= size.y / 0.48;
    });
  }

  // ---- Tangga melayang ke mezzanine Lantai 2 (kuadran timur laut, naik ke Utara) ----
  {
    const s = ACCESS.stairs;
    mountAsset(slot(features, 'Floor2_Staircase', s.x, 0, s.z, s.rotY), '/models/Office_Access_Floor2_Staircase.glb', staircasePlaceholder(s.w, s.h, s.d, s.landing), load);
  }

  // ---- Monstera + lampu plafon cincin ----
  {
    mountAsset(slot(decor, 'Access_Monstera', ACCESS.monstera.x, 0, ACCESS.monstera.z), '/models/Office_Indoor_Plant.glb', new THREE.Group(), load);
    const r = ACCESS.ring;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 10, 48), std(0xfff3e0, 0.4, 0, { emissive: 0xffe2b8, emissiveIntensity: 1.0 }));
    ring.name = 'Ring_Ceiling_Light';
    ring.rotation.x = Math.PI / 2;
    ring.position.set(r.x, r.y, r.z);
    ring.castShadow = false;
    const l = new THREE.PointLight(0xffe7c4, 7, 6, 1.6);
    l.name = 'Access_Ring_Light';
    l.position.set(r.x, r.y - 0.2, r.z);
    decor.add(ring, l);
  }

  const door = slidingGlassDoor({ name: 'Access_Sliding_Door', span: ROOM_ACCESS.northDoor, wallZ: -ROOM_ACCESS.halfZ + 0.12, sense: ACCESS.doorSense, parent: group });

  const toWorldSpot = (p: { x: number; z: number }, rotY = 0): Spot => {
    const v = shell.local(p.x, 0, p.z);
    return { x: v.x, z: v.z, rotY };
  };
  return {
    group,
    bindWalls: shell.bindWalls,
    spotsWorld: () => ({ map: toWorldSpot(ACCESS.mapSpot, ACCESS.mapSpot.rotY), lift: toWorldSpot(ACCESS.liftSpot, ACCESS.liftSpot.rotY) }),
    setMap: (rooms, live) => map.draw(rooms, live),
    setLiftCalled: (on) => { callMat.emissiveIntensity = on ? 1.0 : 0.25; },
    update: (dt, agents) => door.update(dt, agents),
    focusPoint: () => shell.local(-0.2, 1.0, 0.2),
  };
}

// ============================================================================
// Layar peta totem (kanvas, tanpa API key). Ukuran dasar 0,82 × 0,48 m.
// ============================================================================
/** Ruangan Lantai 1 di peta (tapak dunia X -7..31, Z -5..13.4) + id navigasi untuk hitungan agen. */
const MAP_ROOMS: Array<{ id: string; label: string; r: [number, number, number, number] }> = [
  { id: 'main', label: 'Kerja', r: [-7, -5, 7, 5] },
  { id: 'boardroom', label: 'Rapat', r: [7, -5, 15, 3] },
  { id: 'foyer', label: '', r: [7, 3, 15, 5] },
  { id: 'studio', label: 'Studio', r: [15, -5, 21, -1] },
  { id: 'infowall', label: 'Info', r: [21, -5, 26, -1] },
  { id: 'collabpods', label: 'Pods', r: [26, -5, 31, -1] },
  { id: 'commons', label: 'Commons', r: [15, -1, 25, 5] },
  { id: 'workshop', label: 'Workshop', r: [25, -1, 31, 5] },
  { id: 'manager', label: 'Mnjr', r: [-7, 7.4, -1, 13.4] },
  { id: 'lobby', label: 'Lobi', r: [-1, 7.4, 4, 13.4] },
  { id: 'pantry', label: 'Pantry', r: [4, 7.4, 9, 13.4] },
  { id: 'lounge', label: 'Lounge', r: [9, 7.4, 14, 13.4] },
  { id: 'focus', label: 'Fokus', r: [14, 7.4, 18, 13.4] },
  { id: 'server', label: 'IT', r: [18, 7.4, 22, 13.4] },
  { id: 'garden', label: 'Garden', r: [22, 7.4, 27, 13.4] },
  { id: 'access', label: 'Akses', r: [27, 7.4, 31, 13.4] },
];

class FloorMapScreen {
  readonly mesh: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private lastKey = '';

  constructor() {
    this.canvas.width = 820;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = canvasTexture(this.canvas);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.48), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    this.mesh.name = 'Access_Map_Overlay';
    this.draw({}, false);
  }

  draw(rooms: Record<string, number>, live: boolean) {
    const key = JSON.stringify([rooms, live]);
    if (key === this.lastKey) return;
    this.lastKey = key;
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height, font = '"Inter", system-ui, sans-serif';
    c.fillStyle = '#06121a'; c.fillRect(0, 0, W, H);
    c.textBaseline = 'middle';
    c.fillStyle = '#e2e8f0'; c.font = `800 30px ${font}`; c.fillText('LANTAI 1 · 16 / 16 ZONA AKTIF', 24, 34);
    c.fillStyle = live ? '#34d399' : '#fbbf24'; c.font = `700 18px ${font}`; c.fillText(live ? '● LIVE' : '● SIMULASI', W - 130, 34);
    // Denah: utara di atas, Jalan Utama di tengah.
    const ox = 24, oy = 64, sx = (W - 48) / 38, sz = 300 / 18.4;
    const X = (x: number) => ox + (x + 7) * sx, Y = (z: number) => oy + (z + 5) * sz;
    c.fillStyle = '#0b2230'; c.fillRect(X(-7), Y(5), 38 * sx, 2.4 * sz);
    c.fillStyle = '#5ed9e7'; c.font = `600 14px ${font}`; c.fillText('JALAN UTAMA', X(-6.6), Y(6.2));
    for (const room of MAP_ROOMS) {
      const [x0, z0, x1, z1] = room.r, here = room.id === 'access';
      const n = rooms[room.id] ?? 0;
      c.fillStyle = here ? '#1d4a5a' : n > 0 ? '#14425a' : '#102c3b';
      c.fillRect(X(x0), Y(z0), (x1 - x0) * sx, (z1 - z0) * sz);
      c.strokeStyle = here ? '#fbbf24' : '#1e4a5e'; c.lineWidth = here ? 3 : 1.5;
      c.strokeRect(X(x0) + 1, Y(z0) + 1, (x1 - x0) * sx - 2, (z1 - z0) * sz - 2);
      if (room.label) {
        c.fillStyle = here ? '#fbbf24' : '#94a3b8'; c.font = `600 13px ${font}`;
        c.fillText(room.label, X(x0) + 5, Y(z0) + 12);
      }
      if (n > 0) {
        const cx = X((x0 + x1) / 2), cy = Y((z0 + z1) / 2) + 6;
        c.fillStyle = '#38bdf8'; c.beginPath(); c.arc(cx, cy, 12, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#04121a'; c.font = `800 14px ${font}`; c.textAlign = 'center'; c.fillText(String(n), cx, cy + 1); c.textAlign = 'left';
      }
    }
    c.fillStyle = '#fbbf24'; c.font = `700 15px ${font}`; c.fillText('● Anda di sini', X(27.2), Y(13.4) + 16);
    // Pratinjau Lantai 2.
    c.fillStyle = '#0f2a38'; c.fillRect(24, H - 72, W - 48, 50);
    c.fillStyle = '#c084fc'; c.font = `800 20px ${font}`; c.fillText('LANTAI 2 · EKSPANSI AGEN BARU', 40, H - 47);
    c.fillStyle = '#94a3b8'; c.font = `600 16px ${font}`; c.fillText('lift & tangga mezzanine · Segera', W - 300, H - 47);
    this.tex.needsUpdate = true;
  }
}

// ============================================================================
// Tekstur & placeholder prosedural (otomatis diganti GLB bila file-nya ada di public/models)
// ============================================================================
function rnd(seed: number) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

/** Teraso kuarsa terang berbintik, canvas = 1 m. */
function terrazzo() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!, r = rnd(83);
  x.fillStyle = '#d9d6cf'; x.fillRect(0, 0, S, S);
  const chips = ['#a8a39a', '#8c8b86', '#c9b79c', '#6f7b80', '#efece6'];
  for (let i = 0; i < 520; i++) {
    x.fillStyle = chips[Math.floor(r() * chips.length)]!;
    const s = 1 + r() * 4;
    x.beginPath(); x.ellipse(r() * S, r() * S, s, s * (0.5 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2); x.fill();
  }
  x.strokeStyle = 'rgba(120,120,115,0.35)'; x.lineWidth = 1.5; x.strokeRect(0.5, 0.5, S - 1, S - 1);
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.35, 0.02, { map: tex });
}

function liftIndicatorTexture() {
  const c = document.createElement('canvas'); c.width = 340; c.height = 70;
  const x = c.getContext('2d')!;
  x.fillStyle = '#0b0f14'; x.fillRect(0, 0, 340, 70);
  x.fillStyle = '#ffb347'; x.font = '800 40px "Inter", "Segoe UI", system-ui, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('L1  ▲  L2', 170, 37);
  return canvasTexture(c);
}

/**
 * Portal lift, kontrak GLB `Office_Access_Elevator_Portal`: W 1,70 × H 2,45 × D 0,28, origin tengah sisi
 * BELAKANG di lantai (z ≥ 0), pintu menghadap +Z. Kusen gunmetal + reveal perunggu, pintu stainless 1,16 × 2,12,
 * indikator "L1 ▲ L2" di atas pintu, panel panggil di kanan.
 */
function elevatorPlaceholder(W: number, H: number, D: number, callMat: THREE.Material) {
  const g = new THREE.Group();
  g.name = 'Elevator_Placeholder';
  const gun = std(0x1e2329, 0.42, 0.78);
  const bronze = std(0xb39362, 0.3, 0.86);
  const steel = std(0xcfd6dd, 0.26, 0.9);
  const jw = (W - 1.16) / 2;
  [-1, 1].forEach((s) => {
    g.add(box(jw, H, D - 0.02, gun, [s * (W / 2 - jw / 2), H / 2, (D - 0.02) / 2], 'Surround_Jamb'));
    g.add(box(0.03, 2.12, 0.16, bronze, [s * 0.595, 1.06, 0.12], 'Bronze_Reveal'));
  });
  g.add(box(1.16, H - 2.12, D - 0.02, gun, [0, (H + 2.12) / 2, (D - 0.02) / 2], 'Surround_Header'));
  g.add(box(1.16, 2.12, 0.03, std(0x0d1014, 0.6, 0.3), [0, 1.06, 0.03], 'Shaft_Back'));
  [-1, 1].forEach((s) => g.add(box(0.575, 2.12, 0.03, steel, [s * 0.2925, 1.06, 0.095], 'Door_Panel')));
  const ind = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.14), new THREE.MeshBasicMaterial({ map: liftIndicatorTexture(), toneMapped: false }));
  ind.name = 'Floor_Indicator';
  ind.position.set(0, 2.27, D - 0.019);
  g.add(ind);
  g.add(box(0.1, 0.24, 0.02, std(0x101418, 0.3, 0.6), [0.71, 1.05, D - 0.01], 'Call_Panel'));
  g.add(box(0.045, 0.045, 0.012, callMat, [0.71, 1.08, D + 0.004], 'Call_Button'));
  g.add(box(1.24, 0.012, 0.2, std(0x9aa3ab, 0.35, 0.85), [0, 0.006, 0.16], 'Threshold_Sill'));
  enableShadow(g);
  return g;
}

/**
 * Totem peta, kontrak GLB `Office_Access_Floor_Map_Totem`: W 0,95 × H ≤ 1,25 × D 0,55, origin lantai tengah.
 * Layar `Access_Map_Screen` 0,82 × 0,48 di (0, 1,04, 0,02), miring −30° (normal (0, 0,5, 0,866)), menghadap +Z.
 */
function totemPlaceholder(W: number, H: number, D: number) {
  const g = new THREE.Group();
  g.name = 'Totem_Placeholder';
  const alu = std(0x2a3036, 0.38, 0.75);
  const bronze = std(0xb39362, 0.3, 0.86);
  g.add(box(0.6, 0.04, D - 0.05, alu, [0, 0.02, 0], 'Base_Plinth'));
  g.add(box(0.28, 0.74, 0.22, alu, [0, 0.41, -0.04], 'Pedestal_Column'));
  const head = new THREE.Group();
  head.position.set(0, 1.04, 0.02);
  head.rotation.x = -Math.PI / 6;
  head.add(box(W, 0.58, 0.055, alu, [0, 0, -0.03], 'Display_Housing'));
  head.add(box(W - 0.1, 0.05, 0.08, bronze, [0, -0.29, 0.01], 'Wrist_Ledge'));
  g.add(head);
  void H;
  enableShadow(g);
  return g;
}

/**
 * Tangga melayang, kontrak GLB `Office_Access_Floor2_Staircase`: W 1,25 × H 2,35 × D 2,20, origin lantai tengah.
 * 7 anak tangga oak dari y 0,19 (z −0,92) sampai 1,33 (z +0,22), bordes 1,52 di z +0,36..+1,10, pagar kaca,
 * gerbang "LANTAI 2 · SEGERA" di ujung +Z (tulisan di kedua muka agar terbaca dari kamera Tenggara).
 */
function staircasePlaceholder(W: number, H: number, D: number, landing: number) {
  const g = new THREE.Group();
  g.name = 'Staircase_Placeholder';
  const steel = std(0x171a1e, 0.46, 0.78);
  const oak = std(0xb98c5c, 0.46, 0.02);
  const led = std(0xffe5be, 0.4, 0, { emissive: 0xffe5be, emissiveIntensity: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe8f3, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const hz = D / 2;
  // Balok spine diagonal
  const z0 = -0.92, z1 = 0.36, y0 = 0.0, y1 = landing - 0.06;
  const len = Math.hypot(z1 - z0, y1 - y0);
  const spine = box(0.14, 0.18, len, steel, [0, (y0 + y1) / 2, (z0 + z1) / 2], 'Mono_Stringer');
  spine.rotation.x = -Math.atan2(y1 - y0, z1 - z0);
  g.add(spine);
  for (let i = 0; i < 7; i++) {
    const y = 0.19 + i * 0.19, z = -0.92 + i * 0.19;
    g.add(box(1.08, 0.046, 0.26, oak, [0, y - 0.023, z], 'Oak_Tread'));
    const strip = box(1.0, 0.01, 0.015, led, [0, y - 0.05, z + 0.12], 'Step_LED');
    strip.castShadow = false;
    g.add(strip);
  }
  g.add(box(W, 0.06, 0.74, oak, [0, landing - 0.03, 0.73], 'Mezzanine_Deck'));
  g.add(box(W, 0.12, 0.74, steel, [0, landing - 0.12, 0.73], 'Landing_Frame'));
  [-0.52, 0.52].forEach((x) => g.add(box(0.08, landing - 0.12, 0.08, steel, [x, (landing - 0.12) / 2, hz - 0.08], 'Rear_Column')));
  // Pagar kaca: miring sepanjang tangga + lurus sepanjang bordes
  const railH = 0.85;
  [-0.58, 0.58].forEach((x) => {
    const slope = box(0.012, railH, len, glass, [x, (0.19 + 1.33) / 2 + railH / 2, (z0 + 0.22) / 2], 'Glass_Guard_Slope');
    slope.rotation.x = -Math.atan2(1.33 - 0.19, 0.22 - z0);
    slope.castShadow = false;
    g.add(slope);
    const flat = box(0.012, H - landing, 0.74, glass, [x, (landing + H) / 2, 0.73], 'Glass_Guard_Landing');
    flat.castShadow = false;
    g.add(flat, box(0.042, 0.042, 0.74, std(0xc9d0d6, 0.25, 0.9), [x, H - 0.021, 0.73], 'Handrail'));
  });
  // Gerbang Lantai 2 (tertutup) + plakat dua muka
  g.add(box(W - 0.1, H - landing, 0.04, std(0x22313a, 0.2, 0.4, { transparent: true, opacity: 0.6 }), [0, (landing + H) / 2, hz - 0.04], 'Floor2_Gate'));
  const plaque = gateTexture();
  [hz - 0.065, hz - 0.015].forEach((z, i) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.2), new THREE.MeshBasicMaterial({ map: plaque, toneMapped: false }));
    p.name = 'Floor2_Gate_Plaque';
    p.position.set(0, H - 0.2, z);
    if (i === 1) p.rotation.y = 0; else p.rotation.y = Math.PI;
    g.add(p);
  });
  enableShadow(g);
  return g;
}

function gateTexture() {
  const c = document.createElement('canvas'); c.width = 450; c.height = 100;
  const x = c.getContext('2d')!;
  x.fillStyle = '#16232b'; x.fillRect(0, 0, 450, 100);
  x.fillStyle = '#5ed9e7'; x.fillRect(0, 0, 8, 100);
  x.textBaseline = 'middle';
  x.fillStyle = '#e2e8f0'; x.font = '800 38px "Inter", "Segoe UI", system-ui, sans-serif';
  x.fillText('LANTAI 2', 26, 36);
  x.fillStyle = '#fbbf24'; x.font = '600 26px "Inter", "Segoe UI", system-ui, sans-serif';
  x.fillText('Segera · ekspansi agen', 26, 74);
  return canvasTexture(c);
}
