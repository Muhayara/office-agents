import * as THREE from 'three';
import { DOOR_HEIGHT, MANAGER, ROOM_MANAGER, WALL_HEIGHT } from '../layout';
import type { WallFader } from '../camera/wallFade';
import {
  box,
  canvasTexture,
  createCarpetFloor,
  enableShadow,
  lightAnchor,
  type ModelLoader,
  mountAsset,
  std,
  stdLin,
} from './assets';
import { buildSouthRoomShell } from './southWing';
import { smokedGlassWallMats } from './walls';

/**
 * LAYER RUANGAN TAHAP 2: Room_ManagerOffice, pusat dunia (-4.0, 10.4), 6 × 6 m.
 *
 * Ruang kerja privat Manajer (Raka) dan tempat review 1-on-1 dengan CEO.
 * - Utara : kaca gelap + privacy band, pintu geser kaca (daun terparkir terbuka) ke Jalan Utama.
 * - Barat : tepi gedung, satu-satunya dinding yang tetap solid dari kamera Tenggara →
 *           kredenza, TV KPI 55", dan rak buku menempel di sini.
 * - Timur : dinding dalam ke calon Lobi (Tahap 3), selalu memudar di tampilan rumah boneka.
 * - Selatan: dinding luar dengan jendela pemandangan kota dan slat akustik walnut.
 *
 * Workstation Raka (meja L, monitor status, kursi) diisi panggung karena terikat data agen;
 * modul ini hanya menyediakan sub-layer dan pembuat meja eksekutifnya.
 */
export interface KpiInfo {
  total: number;
  working: number;
  waiting: number;
  error: number;
  offline: number;
  /** Agen yang sedang rehat di Pantry. */
  pantry: number;
  /** Topik rapat yang sedang berjalan (null = tidak ada). */
  meeting: string | null;
  live: boolean;
}

export interface ManagerOffice {
  group: THREE.Group;
  workstations: THREE.Group;
  chairs: THREE.Group;
  seatAnchors: THREE.Group;
  setCarpetMaterial: (mat: THREE.MeshStandardMaterial) => void;
  bindWalls: () => void;
  /** Meja L walnut baru (GLB bila ada, placeholder prosedural bila belum). Tanpa monitor. */
  executiveDesk: () => THREE.Group;
  /** Kursi eksekutif kulit Raka (GLB bila ada, `placeholder` bila belum). Depan = +Z. */
  executiveChair: (placeholder: THREE.Object3D) => THREE.Group;
  setKpi: (info: KpiInfo) => void;
  focusPoint: () => THREE.Vector3;
}

export function buildManagerOffice(load: ModelLoader, fader: WallFader): ManagerOffice {
  const shell = buildSouthRoomShell({
    spec: ROOM_MANAGER,
    fader,
    fadeId: 'manager',
    glass: smokedGlassWallMats(),
    glassBand: { yMin: 1.0, yMax: 1.45 },
    interiorSides: ['east'],
  });
  const { group, sub, inner, walls } = shell;
  const floor = sub('SubLayer_Floor');
  const av = sub('SubLayer_AV_KPI');
  const furniture = sub('SubLayer_Furniture');
  const decor = sub('SubLayer_Decor');
  const workstations = sub('SubLayer_Workstations');
  const chairs = sub('SubLayer_Chairs');
  const seatAnchors = sub('SubLayer_SeatAnchors');

  const slot = (parent: THREE.Group, name: string, x: number, y: number, z: number, rotY = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  };

  // ---- Lantai: karpet charcoal (material karpet ruang rapat) + list kayu walnut tipis ----
  const W = inner.maxX - inner.minX;
  const D = inner.maxZ - inner.minZ;
  const border = 0.09;
  const carpet = createCarpetFloor(W - border * 2, D - border * 2, [0, -0.01, 0], 'Manager_Acoustic_Carpet');
  floor.add(carpet.mesh);
  const walnut = stdLin([0.06, 0.028, 0.013], 0.5, 0.05);
  const trim = (w: number, d: number, x: number, z: number, name: string) => {
    const m = box(w, 0.022, d, walnut, [x, -0.008, z], name);
    m.castShadow = false;
    floor.add(m);
  };
  trim(W, border, 0, inner.minZ + border / 2, 'Floor_Trim_N');
  trim(W, border, 0, inner.maxZ - border / 2, 'Floor_Trim_S');
  trim(border, D - border * 2, inner.minX + border / 2, 0, 'Floor_Trim_W');
  trim(border, D - border * 2, inner.maxX - border / 2, 0, 'Floor_Trim_E');

  // Karpet tamu di depan meja (area review 1-on-1)
  {
    const r = MANAGER.rug;
    const rug = box(r.w, 0.012, r.d, std(0x3b4650, 0.95, 0), [r.x, 0.006, r.z], 'Guest_Rug');
    rug.castShadow = false;
    floor.add(rug);
    const edge = box(r.w - 0.16, 0.013, r.d - 0.16, std(0x56636d, 0.95, 0), [r.x, 0.0066, r.z], 'Guest_Rug_Inlay');
    edge.castShadow = false;
    floor.add(edge);
  }

  // ---- Pintu geser kaca: daun terparkir terbuka di sisi dalam, menumpuk panel kaca timur ----
  {
    const leaf = new THREE.Group();
    leaf.name = 'Sliding_Door_Leaf';
    const { xMax } = ROOM_MANAGER.northDoor;
    const lw = 1.46;
    const z = inner.minZ + 0.035;
    const frame = stdLin([0.009, 0.023, 0.03], 0.35, 0.75);
    const glass = new THREE.MeshStandardMaterial({
      color: 0x4a5d66, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide,
    });
    const cx = xMax + lw / 2 + 0.02;
    const hLeaf = DOOR_HEIGHT - 0.03;
    leaf.add(
      box(lw, hLeaf, 0.012, glass, [cx, hLeaf / 2 + 0.01, z], 'Leaf_Glass'),
      box(lw, 0.04, 0.03, frame, [cx, hLeaf, z], 'Leaf_Top_Rail'),
      box(lw, 0.04, 0.03, frame, [cx, 0.03, z], 'Leaf_Bottom_Rail'),
      box(0.03, hLeaf, 0.03, frame, [cx - lw / 2 + 0.015, hLeaf / 2 + 0.01, z], 'Leaf_Stile'),
      box(0.025, 0.55, 0.05, std(0xb8c2c8, 0.25, 0.9), [cx - lw / 2 + 0.07, 1.05, z + 0.03], 'Leaf_Pull'),
      box(lw + 0.3, 0.05, 0.06, frame, [cx - 0.15, DOOR_HEIGHT + 0.03, z], 'Slide_Track'),
    );
    leaf.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = false; } });
    // Bagian dari dinding utara: ikut memudar bersama kaca.
    walls.north.add(leaf);
  }

  // ---- Dinding selatan: jendela pemandangan kota + slat akustik walnut (ikut memudar) ----
  {
    const face = inner.maxZ;
    const win = MANAGER.window;
    const ww = win.xMax - win.xMin;
    const wh = win.yMax - win.yMin;
    const wcx = (win.xMin + win.xMax) / 2;
    const wcy = (win.yMin + win.yMax) / 2;
    const view = new THREE.Mesh(
      new THREE.PlaneGeometry(ww, wh),
      new THREE.MeshBasicMaterial({ map: cityViewTexture(), toneMapped: false }),
    );
    view.name = 'Window_View';
    view.rotation.y = Math.PI;
    view.position.set(wcx, wcy, face - 0.012);
    const frame = stdLin([0.009, 0.023, 0.03], 0.35, 0.75);
    const f = 0.06;
    const fz = face - 0.03;
    const parts = [
      box(ww + f * 2, f, 0.06, frame, [wcx, win.yMax + f / 2, fz], 'Window_Head'),
      box(ww + f * 2, 0.05, 0.16, std(0xd8dde0, 0.4, 0.1), [wcx, win.yMin - 0.025, face - 0.08], 'Window_Sill'),
      box(f, wh, 0.06, frame, [win.xMin - f / 2, wcy, fz], 'Window_Jamb_W'),
      box(f, wh, 0.06, frame, [win.xMax + f / 2, wcy, fz], 'Window_Jamb_E'),
      box(0.035, wh, 0.04, frame, [wcx, wcy, fz + 0.005], 'Window_Mullion'),
    ];
    walls.south.add(view, ...parts);

    // Slat walnut vertikal di kiri-kanan jendela
    const slatH = 2.62;
    const xs: number[] = [];
    for (let x = inner.minX + 0.12; x < win.xMin - 0.15; x += 0.085) xs.push(x);
    for (let x = win.xMax + 0.15; x < inner.maxX - 0.1; x += 0.085) xs.push(x);
    const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.042, slatH, 0.03), walnut.clone(), xs.length);
    slats.name = 'Acoustic_Slats_Walnut';
    const m = new THREE.Matrix4();
    xs.forEach((x, i) => { m.makeTranslation(x, 0.14 + slatH / 2, face - 0.017); slats.setMatrixAt(i, m); });
    slats.instanceMatrix.needsUpdate = true;
    slats.receiveShadow = true;
    const felt = box(inner.maxX - inner.minX - 0.1, slatH, 0.006, std(0x14181b, 0.95, 0), [0, 0.14 + slatH / 2, face - 0.003], 'Acoustic_Felt');
    felt.castShadow = false;
    walls.south.add(felt, slats);
  }

  // ---- Dinding barat: kredenza walnut, TV KPI 55", rak buku ----
  const credenza = slot(furniture, 'Executive_Credenza', MANAGER.credenza.x, 0, MANAGER.credenza.z, Math.PI / 2);
  mountAsset(credenza, '/models/Office_Boardroom_Credenza.glb', credenzaPlaceholder(), load);

  const tvMount = slot(av, 'KPI_Display_55', MANAGER.tv.x, MANAGER.tv.y, MANAGER.tv.z, Math.PI / 2);
  tvMount.scale.setScalar(MANAGER.tv.scale);
  const kpi = new KpiScreen();
  tvMount.add(kpi.mesh);
  const tvSlot = slot(tvMount, 'Display_Model', 0, 0, 0);
  mountAsset(tvSlot, '/models/Office_Presentation_Display_85.glb', displayPlaceholder(), load, (model) => {
    // Pas-kan layar KPI ke area layar aktif GLB (sedikit di depannya).
    let active: THREE.Object3D | undefined = model.getObjectByName('Screen_ActiveArea_4K');
    if (!active) model.traverse((o) => { if (!active && (o as THREE.Mesh).isMesh && /screen/i.test(o.name)) active = o; });
    if (!active) return;
    tvMount.updateWorldMatrix(true, true);
    const bb = new THREE.Box3().setFromObject(active);
    const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
    const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
      const p = tvMount.worldToLocal(new THREE.Vector3(x, y, z));
      lo.min(p);
      hi.max(p);
    }
    const w = hi.x - lo.x, h = hi.y - lo.y;
    if (w > 0.2 && h > 0.2) {
      kpi.mesh.position.set((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, hi.z + 0.006);
      kpi.mesh.scale.set(w / 1.86, h / 1.04, 1);
    }
  });

  const shelf = slot(furniture, 'Bookshelf_Cabinet', MANAGER.bookshelf.x, 0, MANAGER.bookshelf.z, Math.PI / 2);
  mountAsset(shelf, '/models/Office_Bookshelf_Cabinet.glb', new THREE.Group(), load);

  // ---- 2 kursi tamu (lounge fabric) menghadap meja Raka ----
  MANAGER.guestChairs.forEach((c, i) => {
    const s = slot(furniture, `Guest_Lounge_Chair_${i}`, c.x, 0, c.z, c.rotY);
    mountAsset(s, '/models/Office_Guest_Lounge_Chair.glb', loungeChairPlaceholder(), load);
  });

  // ---- Tanaman ----
  const plant = (url: string, name: string, p: { x: number; z: number }, scale: number) => {
    const s = slot(decor, name, p.x, 0, p.z);
    s.scale.setScalar(scale);
    mountAsset(s, url, new THREE.Group(), load);
  };
  plant('/models/Office_Indoor_Plant.glb', 'Plant_SW_FiddleLeaf', MANAGER.plantSW, 1.0);
  plant('/models/Office_Indoor_Plant_SnakePlant.glb', 'Plant_NE', MANAGER.plantNE, 0.85);

  // ---- Lampu hangat di atas meja kerja ----
  {
    const l = MANAGER.light;
    const lamp = lightAnchor(0xffd7a8, 16, 6.5, 1.6);
    lamp.name = 'Manager_Warm_Light';
    lamp.position.set(l.x, l.y, l.z);
    decor.add(lamp);
    // Lampu gantung bulat (emissive saja)
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.32, 0.05, 32),
      std(0x1b2226, 0.4, 0.7, { emissive: 0xffe2b8, emissiveIntensity: 0.25 }),
    );
    shade.position.set(l.x, WALL_HEIGHT - 0.55, l.z);
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.012, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9c9 }),
    );
    ring.position.set(l.x, WALL_HEIGHT - 0.58, l.z);
    const cable = box(0.01, 0.52, 0.01, std(0x111111, 0.5, 0.2), [l.x, WALL_HEIGHT - 0.27, l.z], 'Pendant_Cable');
    cable.castShadow = false;
    decor.add(shade, ring, cable);
  }

  const executiveDesk = () => {
    const g = new THREE.Group();
    g.name = 'Executive_Desk_L';
    mountAsset(g, '/models/Office_Manager_L_Desk.glb', executiveDeskPlaceholder(), load);
    return g;
  };
  const executiveChair = (placeholder: THREE.Object3D) => {
    const g = new THREE.Group();
    g.name = 'Executive_Chair';
    mountAsset(g, '/models/Office_Manager_Executive_Chair.glb', placeholder, load);
    return g;
  };

  return {
    group,
    workstations,
    chairs,
    seatAnchors,
    setCarpetMaterial: carpet.applyMaterial,
    bindWalls: shell.bindWalls,
    executiveDesk,
    executiveChair,
    setKpi: (info) => kpi.draw(info),
    focusPoint: () => shell.local(-0.5, 1.05, 0.2),
  };
}

// ============================================================================
// Layar KPI (kanvas, tanpa API key). Ukuran dasar 1,86 × 1,04 (sama dengan TvScreen).
// ============================================================================
class KpiScreen {
  readonly mesh: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private lastKey = '';

  constructor() {
    this.canvas.width = 768;
    this.canvas.height = 430;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = canvasTexture(this.canvas);
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.86, 1.04),
      new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }),
    );
    this.mesh.name = 'KPI_Screen';
    this.mesh.position.set(0, -0.055, 0.09);
    this.draw({ total: 0, working: 0, waiting: 0, error: 0, offline: 0, pantry: 0, meeting: null, live: false });
  }

  draw(info: KpiInfo) {
    const key = JSON.stringify(info);
    if (key === this.lastKey) return;
    this.lastKey = key;
    const c = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    c.fillStyle = '#06121a';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#0d2633';
    c.fillRect(0, 0, W, 64);
    c.textBaseline = 'middle';
    c.fillStyle = '#e2e8f0';
    c.font = '700 32px "Inter", system-ui, sans-serif';
    c.fillText('KPI SPRINT · TIM AGEN', 26, 33);
    c.fillStyle = info.live ? '#34d399' : '#fbbf24';
    c.font = '600 20px "Inter", system-ui, sans-serif';
    c.fillText(info.live ? '● LIVE' : '● SIMULASI', W - 150, 34);

    const total = Math.max(1, info.total);
    const tiles: Array<[string, number, string]> = [
      ['Bekerja', info.working, '#38bdf8'],
      ['Menunggu izin', info.waiting, '#fbbf24'],
      ['Error', info.error, '#f87171'],
      ['Rehat pantry', info.pantry, '#a78bfa'],
    ];
    const tw = (W - 26 * 2 - 18 * 3) / 4;
    tiles.forEach(([label, value, color], i) => {
      const x = 26 + i * (tw + 18);
      c.fillStyle = '#0b1f2a';
      c.fillRect(x, 88, tw, 132);
      c.fillStyle = color;
      c.fillRect(x, 88, tw, 6);
      c.font = '700 64px "Inter", system-ui, sans-serif';
      c.fillText(String(value), x + 18, 158);
      c.fillStyle = '#94a3b8';
      c.font = '500 19px "Inter", system-ui, sans-serif';
      c.fillText(label, x + 18, 200);
    });

    // Bar utilisasi tim
    const online = Math.max(0, info.total - info.offline);
    const util = info.working / total;
    c.fillStyle = '#94a3b8';
    c.font = '500 20px "Inter", system-ui, sans-serif';
    c.fillText(`Utilisasi tim ${Math.round(util * 100)}%  ·  online ${online}/${info.total}`, 26, 262);
    c.fillStyle = '#12303f';
    c.fillRect(26, 284, W - 52, 22);
    c.fillStyle = '#38bdf8';
    c.fillRect(26, 284, (W - 52) * util, 22);

    c.fillStyle = info.meeting ? '#f87171' : '#34d399';
    c.beginPath();
    c.arc(40, 352, 10, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e2e8f0';
    c.font = '600 22px "Inter", system-ui, sans-serif';
    let line = info.meeting ? `Rapat berjalan: ${info.meeting.replace(/\s+/g, ' ').trim()}` : 'Ruang rapat tersedia';
    while (line.length > 4 && c.measureText(line).width > W - 90) line = `${line.slice(0, -2)}…`;
    c.fillText(line, 62, 353);
    c.fillStyle = '#64748b';
    c.font = '400 18px "Inter", system-ui, sans-serif';
    c.fillText('Review 1-on-1 dengan CEO: ketuk pintu kaca, Raka siap.', 26, 400);
    c.fillStyle = '#38bdf8';
    c.fillRect(0, H - 6, W, 6);
    this.tex.needsUpdate = true;
  }
}

// ============================================================================
// Pemandangan kota di balik jendela (kanvas statis)
// ============================================================================
function cityViewTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;
  const sky = c.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#16324a');
  sky.addColorStop(0.55, '#3c6a86');
  sky.addColorStop(1, '#d9a777');
  c.fillStyle = sky;
  c.fillRect(0, 0, 512, 256);
  // Siluet gedung + jendela menyala (pseudo-acak deterministik)
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let layer = 0; layer < 2; layer++) {
    let x = -10;
    while (x < 512) {
      const w = 26 + rnd() * 46;
      const h = (layer === 0 ? 70 : 40) + rnd() * (layer === 0 ? 90 : 120);
      c.fillStyle = layer === 0 ? '#1d3346' : '#0e1c28';
      c.fillRect(x, 256 - h, w, h);
      if (layer === 1) {
        c.fillStyle = 'rgba(255, 214, 150, 0.75)';
        for (let wy = 256 - h + 8; wy < 248; wy += 12) {
          for (let wx = x + 5; wx < x + w - 6; wx += 9) if (rnd() > 0.55) c.fillRect(wx, wy, 4, 5);
        }
      }
      x += w + 4 + rnd() * 10;
    }
  }
  return canvasTexture(canvas);
}

// ============================================================================
// Placeholder prosedural (otomatis diganti GLB bila file-nya ada di public/models)
// ============================================================================
/**
 * Meja L walnut Raka (kontrak Office_Manager_L_Desk.glb) di koordinat workstation: agen duduk
 * di +Z menghadap -Z. Origin = pusat sayap utama di lantai.
 * - Sayap utama 1,8 (X) × 0,8 (Z), atas 0,75 m.
 * - Sayap return di sisi KANAN agen (+X), atas 0,72 m, berbentuk L: X 0.65..1.2 menjorok ke arah
 *   kursi sampai Z 1.2 (kedalaman total 1,6 m) + lis 0,3 m di samping ujung sayap utama.
 *   Bounding box 2,10 × 1,60 m (X -0.9..1.2, Z -0.4..1.2).
 */
function executiveDeskPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Executive_Desk_Placeholder';
  const walnut = std(0x3a2617, 0.38, 0.04);
  const walnutDark = std(0x271c14, 0.45, 0.04);
  const steel = std(0x1f2429, 0.45, 0.85);
  const leather = std(0x18191c, 0.65, 0.02);
  g.add(box(1.8, 0.045, 0.8, walnut, [0, 0.7275, 0], 'Desk_Top'));
  g.add(box(1.0, 0.004, 0.55, leather, [0, 0.752, 0.08], 'Desk_Pad'));
  g.add(box(1.62, 0.42, 0.006, walnutDark, [0, 0.49, -0.37], 'Modesty_Panel'));
  for (const x of [-0.83, 0.83]) g.add(box(0.025, 0.705, 0.7, steel, [x, 0.3525, 0], 'Sled_Leg'));
  // Sayap return berbentuk L (atas 0,72 m)
  const ret = new THREE.Shape();
  ret.moveTo(0.9, -0.4); ret.lineTo(1.2, -0.4); ret.lineTo(1.2, 1.2);
  ret.lineTo(0.65, 1.2); ret.lineTo(0.65, 0.4); ret.lineTo(0.9, 0.4); ret.closePath();
  const retGeo = new THREE.ExtrudeGeometry(ret, { depth: 0.045, bevelEnabled: false });
  retGeo.rotateX(Math.PI / 2);
  const retTop = new THREE.Mesh(retGeo, walnut);
  retTop.name = 'Return_Top';
  retTop.position.y = 0.72;
  g.add(retTop);
  g.add(box(0.5, 0.62, 0.54, walnutDark, [0.92, 0.33, 0.9], 'Return_Pedestal'));
  for (const y of [0.18, 0.39, 0.58]) {
    g.add(box(0.006, 0.17, 0.48, std(0x0b0b0b, 0.6, 0.2), [0.667, y, 0.9], 'Drawer_Gap'));
    g.add(box(0.012, 0.012, 0.15, std(0xb8c2c8, 0.2, 0.9), [0.662, y + 0.07, 0.9], 'Drawer_Pull'));
  }
  g.add(box(0.025, 0.675, 0.025, steel, [1.17, 0.3375, -0.37], 'Return_Leg'));
  // Aksesori: baki dokumen aluminium & tempat pena hitam
  const alu = std(0xb8c2c8, 0.25, 0.9);
  g.add(box(0.26, 0.012, 0.24, alu, [0.6, 0.756, -0.22], 'Doc_Tray_Base'));
  for (const z of [-0.3, -0.22, -0.14]) g.add(box(0.26, 0.22, 0.006, alu, [0.6, 0.87, z], 'Doc_Tray_Divider'));
  g.add(box(0.22, 0.25, 0.012, std(0xeef2f5, 0.7, 0), [0.6, 0.88, -0.26], 'Doc_Papers'));
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 16), std(0x16181b, 0.6, 0.1));
  cup.position.set(-0.62, 0.8, -0.22);
  g.add(cup);
  enableShadow(g);
  return g;
}

function credenzaPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Credenza_Placeholder';
  g.add(box(1.8, 0.7, 0.45, std(0x3d2314, 0.45, 0.05), [0, 0.42, 0], 'Credenza_Body'));
  g.add(box(1.76, 0.07, 0.42, std(0x14181c, 0.4, 0.7), [0, 0.035, 0], 'Credenza_Plinth'));
  enableShadow(g);
  return g;
}

function displayPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Display_Placeholder';
  g.add(box(1.9, 1.1, 0.06, std(0x0b0f12, 0.3, 0.5), [0, -0.055, 0.03], 'Display_Bezel'));
  return g;
}

/** Kursi tamu lounge fabric (kontrak Office_Guest_Lounge_Chair.glb 0,62 × 0,60 × 0,82 m), depan = +Z. */
function loungeChairPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Lounge_Chair_Placeholder';
  const fabric = std(0x3a3f47, 0.9, 0);
  const fabricDark = std(0x2a2e35, 0.9, 0);
  const oak = std(0xc8a27a, 0.45, 0.02);
  g.add(box(0.5, 0.06, 0.48, fabric, [0, 0.41, 0.04], 'Seat_Cushion'));
  g.add(box(0.6, 0.08, 0.56, fabricDark, [0, 0.34, 0.01], 'Seat_Shell'));
  const back = box(0.6, 0.44, 0.08, fabricDark, [0, 0.6, -0.24], 'Backrest');
  back.rotation.x = -0.14;
  g.add(back);
  for (const x of [-0.27, 0.27]) g.add(box(0.07, 0.24, 0.5, fabricDark, [x, 0.5, -0.02], 'Arm_Wing'));
  for (const x of [-0.22, 0.22]) for (const z of [-0.2, 0.2]) {
    const leg = box(0.035, 0.27, 0.035, oak, [x, 0.13, z], 'Leg');
    leg.rotation.z = x < 0 ? 0.12 : -0.12;
    g.add(leg);
  }
  enableShadow(g);
  return g;
}
