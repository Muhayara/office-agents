import * as THREE from 'three';
import { LOBBY, ROOM_LOBBY, type Spot } from '../layout';
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
import type { Pt } from '../layout';

/**
 * LAYER RUANGAN TAHAP 3: Room_LobbyReception, pusat dunia (1.5, 10.4), 5 × 6 m.
 *
 * Gerbang masuk gedung dan titik spawn agen yang baru hadir.
 * - Utara : kaca + pintu geser ganda otomatis 1,6 m (sensor gerak) ke Jalan Utama.
 * - Barat / Timur: dinding milik Ruang Manajer & Pantry (tidak dibangun ulang).
 * - Barat (muka): dinding fitur marmer hitam Nero Marquina + logo "OFFICE AGENTS" berlampu,
 *   di belakang meja resepsionis melengkung yang menghadap Timur (terlihat dari kamera).
 * - Selatan: dinding luar berlapis marmer hitam (memudar di kamera isometrik).
 */
export interface DirectoryInfo {
  present: number;
  total: number;
  live: boolean;
  /** Jumlah agen per ruangan (id ruangan navigasi → jumlah). */
  rooms: Record<string, number>;
}

export interface LobbyReception {
  group: THREE.Group;
  bindWalls: () => void;
  /** Titik spawn (karpet selamat datang) di dunia, menghadap pintu. */
  spawnWorld: () => Spot;
  setDirectory: (info: DirectoryInfo) => void;
  update: (dt: number, agents: readonly Pt[]) => void;
  focusPoint: () => THREE.Vector3;
}

export function buildLobbyReception(load: ModelLoader, fader: WallFader): LobbyReception {
  const shell = buildSouthRoomShell({
    spec: ROOM_LOBBY,
    fader,
    fadeId: 'lobby',
    glass: glassWallMats(),
    interiorSides: [],
    sides: { west: false, east: false },
  });
  const { group, sub, inner, walls } = shell;
  const floor = sub('SubLayer_Floor');
  const feature = sub('SubLayer_FeatureWall');
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

  // ---- Lantai marmer putih poles (ubin 60 cm) + list hitam tipis di tepi ----
  {
    const W = inner.maxX - inner.minX, D = inner.maxZ - inner.minZ, b = 0.06;
    const tiles = meterBox(W - 2 * b, 0.02, D - 2 * b, whiteMarbleTileMaterial(), [(inner.minX + inner.maxX) / 2, -0.01, 0], 'Lobby_Polished_Marble');
    floor.add(tiles);
    const black = std(0x0d0f11, 0.2, 0.1);
    const strip = (w: number, d: number, x: number, z: number, n: string) => { const m = box(w, 0.02, d, black, [x, -0.01, z], n); m.castShadow = false; floor.add(m); };
    strip(W, b, (inner.minX + inner.maxX) / 2, inner.minZ + b / 2, 'Border_N');
    strip(W, b, (inner.minX + inner.maxX) / 2, inner.maxZ - b / 2, 'Border_S');
    strip(b, D - 2 * b, inner.minX + b / 2, 0, 'Border_W');
    strip(b, D - 2 * b, inner.maxX - b / 2, 0, 'Border_E');
  }

  // ---- Karpet selamat datang (titik spawn) ----
  {
    const s = LOBBY.spawn;
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.012, 48), std(0x1f4d55, 0.95, 0));
    rug.position.set(s.x, 0.006, s.z);
    rug.name = 'Welcome_Rug';
    rug.receiveShadow = true;
    const inside = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.013, 48), std(0xd8d2c4, 0.95, 0));
    inside.position.set(s.x, 0.0065, s.z);
    const mark = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 40), new THREE.MeshStandardMaterial({ color: 0x1f4d55, roughness: 0.9 }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(s.x, 0.0135, s.z);
    floor.add(rug, inside, mark);
  }

  // ---- Dinding selatan: lapis marmer hitam Nero Marquina (ikut memudar) ----
  {
    const face = inner.maxZ;
    const panel = meterBox(inner.maxX - inner.minX - 0.1, 2.9, 0.02, blackMarbleMaterial(), [(inner.minX + inner.maxX) / 2, 0.12 + 1.45, face - 0.01], 'South_Nero_Marquina');
    walls.south.add(panel);
  }

  // ---- Dinding fitur di sisi barat: marmer hitam + logo timbul berlampu latar (tetap solid) ----
  {
    const f = LOBBY.featureWall;
    const slab = meterBox(f.t, f.h, f.w, blackMarbleMaterial(), [f.x, f.h / 2, f.z], 'Feature_Wall_Nero_Marquina');
    slab.castShadow = false;
    feature.add(slab);
    // Logo "OFFICE AGENTS" (huruf baja timbul + halo hangat), menghadap Timur
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.55),
      new THREE.MeshBasicMaterial({ map: logoTexture(), transparent: true, toneMapped: false, depthWrite: false }),
    );
    logo.name = 'Backlit_Logo_Office_Agents';
    logo.rotation.y = Math.PI / 2;
    logo.position.set(f.x + f.t / 2 + 0.012, 1.95, f.z);
    // Strip LED hangat di bawah & atas slab
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xffd9a8 });
    const ledTop = box(0.01, 0.012, f.w - 0.2, ledMat, [f.x + f.t / 2 + 0.006, f.h - 0.08, f.z], 'Feature_LED_Top');
    const ledBottom = box(0.01, 0.012, f.w - 0.2, ledMat, [f.x + f.t / 2 + 0.006, 0.08, f.z], 'Feature_LED_Bottom');
    ledTop.castShadow = ledBottom.castShadow = false;
    feature.add(logo, ledTop, ledBottom);
  }

  // ---- Meja resepsionis melengkung + kursi resepsionis ----
  {
    const r = LOBBY.reception;
    const desk = slot(furniture, 'Reception_Desk_Curved', r.cx, 0, r.cz, Math.PI / 2);
    mountAsset(desk, '/models/Office_Lobby_Reception_Desk.glb', receptionDeskPlaceholder(r.rIn, r.rWork, r.rOut, r.halfDeg), load);
    const c = LOBBY.receptionistChair;
    mountAsset(slot(furniture, 'Receptionist_Chair', c.x, 0, c.z, c.rotY), '/models/Office_Ergonomic_Chair.glb', new THREE.Group(), load);
  }

  // ---- Kios direktori digital (layar kanvas: denah + kehadiran agen) ----
  const kiosk = new DirectoryScreen();
  {
    const k = LOBBY.kiosk;
    const kslot = slot(furniture, 'Directory_Kiosk', k.x, 0, k.z, k.rotY);
    kslot.add(kiosk.mesh);
    mountAsset(kslot, '/models/Office_Lobby_Directory_Kiosk.glb', kioskPlaceholder(), load, (model) => {
      let screen: THREE.Object3D | undefined;
      model.traverse((o) => { if (!screen && (o as THREE.Mesh).isMesh && /screen/i.test(o.name)) screen = o; });
      if (!screen) return;
      kslot.updateWorldMatrix(true, true);
      const bb = new THREE.Box3().setFromObject(screen);
      const lo = kslot.worldToLocal(bb.min.clone()), hi = kslot.worldToLocal(bb.max.clone());
      const w = Math.abs(hi.x - lo.x), h = Math.abs(hi.y - lo.y);
      if (w > 0.1 && h > 0.1) {
        kiosk.mesh.position.set((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, Math.max(lo.z, hi.z) + 0.004);
        kiosk.mesh.scale.set(w / 0.42, h / 0.7, 1);
      }
    });
  }

  // ---- Area duduk tamu: 2 kursi aksen velvet teal + meja bundar kecil ----
  {
    const t = LOBBY.sideTable;
    mountAsset(slot(furniture, 'Lobby_Side_Table', t.x, 0, t.z), '/models/Office_Lobby_Side_Table.glb', sideTablePlaceholder(), load);
    LOBBY.accentChairs.forEach((c, i) => {
      mountAsset(slot(furniture, `Lobby_Accent_Chair_${i}`, c.x, 0, c.z, c.rotY), '/models/Office_Lobby_Accent_Chair.glb', accentChairPlaceholder(), load);
    });
  }

  // ---- Tanaman & lampu ----
  LOBBY.plants.forEach((p, i) => {
    const s = slot(decor, `Lobby_Plant_${i}`, p.x, 0, p.z);
    s.scale.setScalar(0.95);
    mountAsset(s, '/models/Office_Indoor_Plant.glb', new THREE.Group(), load);
  });
  {
    const l = LOBBY.light;
    const lamp = new THREE.PointLight(0xffe2bd, 14, 6.5, 1.6);
    lamp.name = 'Lobby_Warm_Light';
    lamp.position.set(l.x, l.y, l.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 10, 48), new THREE.MeshBasicMaterial({ color: 0xfff1dc }));
    ring.name = 'Ceiling_Ring_Light';
    ring.rotation.x = Math.PI / 2;
    ring.position.set(l.x, 2.95, l.z);
    decor.add(lamp, ring);
  }

  // ---- Pintu geser ganda otomatis (bagian dinding utara: ikut memudar) ----
  const door = slidingGlassDoor({ name: 'Lobby_Auto_Door', span: ROOM_LOBBY.northDoor, wallZ: -ROOM_LOBBY.halfZ + 0.12, sense: LOBBY.doorSense, parent: group });
  walls.north.add(door.group);

  return {
    group,
    bindWalls: shell.bindWalls,
    spawnWorld: () => {
      const v = shell.local(LOBBY.spawn.x, 0, LOBBY.spawn.z);
      return { x: v.x, z: v.z, rotY: LOBBY.spawn.rotY };
    },
    setDirectory: (info) => kiosk.draw(info),
    update: (dt, agents) => door.update(dt, agents),
    focusPoint: () => shell.local(0, 1.05, 0.3),
  };
}

// ============================================================================
// Tekstur prosedural
// ============================================================================
function rnd(seed: number) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

/** Marmer putih poles: canvas = 1,2 m (2 × 2 ubin 60 cm), urat abu-abu halus, nat tipis. */
function whiteMarbleTileMaterial() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#eceae6'; x.fillRect(0, 0, S, S);
  const r = rnd(5);
  for (let t = 0; t < 4; t++) {
    const ox = (t % 2) * S / 2, oy = Math.floor(t / 2) * S / 2;
    x.save(); x.beginPath(); x.rect(ox, oy, S / 2, S / 2); x.clip();
    x.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.2})`; x.fillRect(ox, oy, S / 2, S / 2);
    for (let v = 0; v < 5; v++) {
      x.strokeStyle = `rgba(150,150,155,${0.12 + r() * 0.18})`; x.lineWidth = 0.6 + r() * 1.4;
      x.beginPath();
      let px = ox + r() * S / 2, py = oy;
      x.moveTo(px, py);
      for (let k = 0; k < 8; k++) { px += (r() - 0.35) * 40; py += S / 16; x.lineTo(px, py); }
      x.stroke();
    }
    x.restore();
  }
  x.strokeStyle = 'rgba(160,158,152,0.9)'; x.lineWidth = 2;
  [0, S / 2].forEach((p) => { x.beginPath(); x.moveTo(p, 0); x.lineTo(p, S); x.stroke(); x.beginPath(); x.moveTo(0, p); x.lineTo(S, p); x.stroke(); });
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 1.2, 1 / 1.2);
  return std(0xffffff, 0.12, 0.05, { map: tex });
}

/** Nero Marquina: hitam dengan urat putih tajam. Canvas = 1 m. */
function blackMarbleMaterial() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#111214'; x.fillRect(0, 0, S, S);
  const r = rnd(17);
  for (let v = 0; v < 14; v++) {
    x.strokeStyle = `rgba(235,235,235,${0.12 + r() * 0.5})`; x.lineWidth = 0.5 + r() * 1.6;
    x.beginPath();
    let px = r() * S, py = 0;
    x.moveTo(px, py);
    for (let k = 0; k < 12; k++) { px += (r() - 0.5) * 70; py += S / 12 + (r() - 0.5) * 20; x.lineTo(px, py); }
    x.stroke();
  }
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.15, 0.1, { map: tex });
}

/** Logo "OFFICE AGENTS": huruf baja dengan halo hangat (latar transparan). */
function logoTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 1024, 256);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '800 118px "Inter", "Segoe UI", system-ui, sans-serif';
  x.shadowColor = 'rgba(255, 196, 120, 0.95)'; x.shadowBlur = 38;
  x.fillStyle = '#d9dde2';
  x.fillText('OFFICE AGENTS', 512, 112);
  x.shadowBlur = 14; x.fillText('OFFICE AGENTS', 512, 112);
  x.shadowBlur = 0;
  const g = x.createLinearGradient(0, 60, 0, 170);
  g.addColorStop(0, '#f4f6f8'); g.addColorStop(1, '#9aa3ab');
  x.fillStyle = g; x.fillText('OFFICE AGENTS', 512, 112);
  x.font = '500 34px "Inter", "Segoe UI", system-ui, sans-serif';
  x.fillStyle = 'rgba(255, 224, 182, 0.9)';
  x.fillText('VIRTUAL AI OFFICE  ·  LANTAI 1', 512, 206);
  return canvasTexture(c);
}

// ============================================================================
// Layar kios direktori (kanvas, tanpa API key). Ukuran dasar 0,42 × 0,70 m.
// ============================================================================
const ROOM_LABELS: Array<[string, string]> = [
  ['main', 'Ruang Kerja'], ['boardroom', 'Ruang Rapat'], ['manager', 'Manajer'], ['pantry', 'Pantry'],
  ['lounge', 'Lounge'], ['server', 'Server / IT'], ['lobby', 'Lobi'],
];

class DirectoryScreen {
  readonly mesh: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private lastKey = '';

  constructor() {
    this.canvas.width = 384;
    this.canvas.height = 640;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = canvasTexture(this.canvas);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.7), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    this.mesh.name = 'Directory_Screen';
    this.mesh.position.set(0, 1.27, 0.056);
    this.draw({ present: 0, total: 0, live: false, rooms: {} });
  }

  draw(info: DirectoryInfo) {
    const key = JSON.stringify(info);
    if (key === this.lastKey) return;
    this.lastKey = key;
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    c.fillStyle = '#071219'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#0f2a38'; c.fillRect(0, 0, W, 70);
    c.textBaseline = 'middle';
    c.fillStyle = '#e2e8f0'; c.font = '700 26px "Inter", system-ui, sans-serif';
    c.fillText('DIREKTORI', 22, 26);
    c.fillStyle = '#7dd3fc'; c.font = '500 18px "Inter", system-ui, sans-serif';
    c.fillText('Lantai 1 · Office Agents', 22, 52);

    // Denah mini: utara di atas (ruang kerja + rapat), Jalan Utama, sisi selatan
    const ox = 22, oy = 92, sx = (W - 44) / 38, sz = 150 / 18.4;
    const rect = (x0: number, z0: number, x1: number, z1: number, fill: string, label?: string, hi = false) => {
      const X = ox + (x0 + 7) * sx, Y = oy + (z0 + 5) * sz, w = (x1 - x0) * sx, h = (z1 - z0) * sz;
      c.fillStyle = fill; c.fillRect(X, Y, w, h);
      c.strokeStyle = hi ? '#fbbf24' : '#1e3a4a'; c.lineWidth = hi ? 3 : 1; c.strokeRect(X + 0.5, Y + 0.5, w - 1, h - 1);
      if (label) { c.fillStyle = hi ? '#fbbf24' : '#94a3b8'; c.font = '600 11px "Inter", system-ui, sans-serif'; c.fillText(label, X + 3, Y + h / 2); }
    };
    rect(-7, -5, 7, 5, '#123544', 'Kerja');
    rect(7, -5, 15, 3, '#123544', 'Rapat');
    rect(7, 3, 15, 5, '#0f2a38');
    rect(-7, 5, 31, 7.4, '#0b2230', 'Jalan Utama');
    rect(-7, 7.4, -1, 13.4, '#123544', 'Mnjr');
    rect(-1, 7.4, 4, 13.4, '#173f4f', 'Lobi', true);
    rect(4, 7.4, 9, 13.4, '#123544', 'Pantry');
    rect(9, 7.4, 14, 13.4, '#123544', 'Lounge');
    rect(18, 7.4, 22, 13.4, '#123544', 'IT');
    c.fillStyle = '#fbbf24'; c.font = '700 14px "Inter", system-ui, sans-serif';
    c.fillText('▲ Anda di sini', ox + (1.5 + 7) * sx - 40, oy + 18.4 * sz + 16);

    // Kehadiran agen
    let y = 300;
    c.fillStyle = '#e2e8f0'; c.font = '700 22px "Inter", system-ui, sans-serif';
    c.fillText('KEHADIRAN AGEN', 22, y);
    c.fillStyle = info.live ? '#34d399' : '#fbbf24'; c.font = '600 15px "Inter", system-ui, sans-serif';
    c.fillText(info.live ? '● LIVE' : '● SIMULASI', W - 110, y + 1);
    y += 46;
    c.fillStyle = '#38bdf8'; c.font = '800 56px "Inter", system-ui, sans-serif';
    c.fillText(`${info.present}`, 22, y);
    c.fillStyle = '#94a3b8'; c.font = '500 24px "Inter", system-ui, sans-serif';
    c.fillText(`/ ${info.total} hadir`, 22 + c.measureText(`${info.present}`).width * 2.4 + 8, y + 6);
    y += 48;
    c.font = '500 19px "Inter", system-ui, sans-serif';
    ROOM_LABELS.forEach(([id, label]) => {
      const n = info.rooms[id] ?? 0;
      c.fillStyle = '#cbd5e1'; c.fillText(label, 22, y);
      c.fillStyle = n > 0 ? '#e2e8f0' : '#475569'; c.textAlign = 'right'; c.fillText(String(n), W - 24, y); c.textAlign = 'left';
      c.fillStyle = '#12303f'; c.fillRect(22, y + 14, W - 44, 2);
      y += 34;
    });
    c.fillStyle = '#38bdf8'; c.fillRect(0, H - 6, W, 6);
    this.tex.needsUpdate = true;
  }
}

// ============================================================================
// Placeholder prosedural (otomatis diganti GLB bila file-nya ada di public/models)
// ============================================================================
/**
 * Meja resepsionis melengkung (busur ±halfDeg di sekitar +Z, pusat busur = origin):
 * badan berlapis bilah kayu vertikal, ledge marmer Carrara setinggi 1,06 m di sisi tamu,
 * permukaan kerja 0,75 m di sisi dalam dengan terminal & telepon interkom. Depan = +Z.
 */
function receptionDeskPlaceholder(rIn: number, rWork: number, rOut: number, halfDeg: number) {
  const g = new THREE.Group();
  g.name = 'Reception_Desk_Placeholder';
  const a0 = Math.PI / 2 - THREE.MathUtils.degToRad(halfDeg), a1 = Math.PI / 2 + THREE.MathUtils.degToRad(halfDeg);
  const sector = (r0: number, r1: number) => {
    const s = new THREE.Shape();
    s.absarc(0, 0, r1, a0, a1, false);
    s.absarc(0, 0, r0, a1, a0, true);
    s.closePath();
    return s;
  };
  const ring = (r0: number, r1: number, y0: number, y1: number, mat: THREE.Material, name: string) => {
    const geo = new THREE.ExtrudeGeometry(sector(r0, r1), { depth: y1 - y0, bevelEnabled: false, curveSegments: 24 });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, y1, 0);
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    g.add(m);
    return m;
  };
  // Shape (x, y) → setelah rotateX(π/2): y → z. Busur di sekitar +y shape = +Z dunia.
  const carcass = std(0x2a2e33, 0.5, 0.2);
  const marble = std(0xf1f5f9, 0.2, 0.05);
  const oak = std(0x9a6b43, 0.5, 0.05);
  ring(rWork + 0.12, rOut, 0.08, 1.03, carcass, 'Counter_Body');
  ring(rWork + 0.08, rOut + 0.04, 1.03, 1.06, marble, 'Transaction_Ledge_Marble');
  ring(rIn, rWork + 0.12, 0.72, 0.75, marble, 'Work_Surface');
  ring(rWork + 0.1, rOut - 0.04, 0.0, 0.08, std(0x111315, 0.6, 0.3), 'Plinth');
  // Bilah kayu vertikal di muka luar
  const n = Math.round((a1 - a0) / THREE.MathUtils.degToRad(3.6));
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * i / n;
    const slat = box(0.03, 0.92, 0.022, oak, [Math.cos(a) * (rOut + 0.012), 0.55, Math.sin(a) * (rOut + 0.012)], 'Wood_Slat');
    slat.rotation.y = Math.PI / 2 - a;
    g.add(slat);
  }
  // Panel ujung + kaki permukaan kerja
  [a0, a1].forEach((a, i) => {
    const r = (rIn + rOut) / 2;
    const end = box(rOut - rIn, 0.98, 0.03, carcass, [Math.cos(a) * r, 0.49 + 0.06, Math.sin(a) * r], `End_Panel_${i}`);
    end.rotation.y = -a;
    g.add(end);
  });
  // Terminal resepsionis (menghadap ke dalam, -Z) + keyboard + telepon interkom
  const rm = (rIn + rWork) / 2 + 0.12;
  const mon = box(0.5, 0.3, 0.03, std(0x0b0f12, 0.3, 0.4), [0, 1.0, rm], 'Terminal_Monitor');
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.26), new THREE.MeshBasicMaterial({ color: 0x1e5a7a }));
  screen.position.set(0, 1.0, rm - 0.017);
  screen.rotation.y = Math.PI;
  const stand = box(0.04, 0.22, 0.04, std(0x1c2226, 0.4, 0.7), [0, 0.86, rm + 0.02], 'Terminal_Stand');
  const kb = box(0.36, 0.015, 0.12, std(0x1a1d21, 0.6, 0.2), [0, 0.758, rm - 0.24], 'Terminal_Keyboard');
  const phone = box(0.16, 0.05, 0.2, std(0x15181b, 0.5, 0.2), [0.42, 0.775, rm - 0.18], 'Intercom_Phone');
  phone.rotation.y = 0.5;
  const handset = box(0.05, 0.035, 0.19, std(0x0f1113, 0.5, 0.2), [0.47, 0.81, rm - 0.18], 'Intercom_Handset');
  handset.rotation.y = 0.5;
  g.add(mon, screen, stand, kb, phone, handset);
  enableShadow(g);
  return g;
}

/** Kios direktori berdiri: totem 0,5 × 1,75 m, layar potret 0,42 × 0,70 m. Depan = +Z. */
function kioskPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Directory_Kiosk_Placeholder';
  const body = std(0x1b2228, 0.35, 0.6);
  g.add(box(0.5, 0.02, 0.36, std(0x2b3238, 0.3, 0.8), [0, 0.01, 0], 'Base_Plate'));
  g.add(box(0.5, 1.73, 0.1, body, [0, 0.885, 0], 'Totem_Body'));
  g.add(box(0.46, 0.74, 0.01, std(0x05080a, 0.1, 0.3), [0, 1.27, 0.05], 'Screen_Bezel'));
  g.add(box(0.5, 0.03, 0.11, std(0xc9a24a, 0.3, 0.9), [0, 1.765, 0], 'Brass_Cap'));
  enableShadow(g);
  return g;
}

/** Kursi aksen velvet teal (tub chair) 0,7 × 0,72 m, depan = +Z. */
function accentChairPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Accent_Chair_Placeholder';
  const velvet = std(0x0f6b6b, 0.75, 0);
  const velvetDark = std(0x0b5656, 0.8, 0);
  const brass = std(0xc9a24a, 0.3, 0.9);
  g.add(box(0.56, 0.1, 0.52, velvet, [0, 0.42, 0.04], 'Seat_Cushion'));
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.33, 0.36, 28, 1, true, Math.PI * 0.75, Math.PI * 1.5), velvetDark);
  back.position.set(0, 0.55, 0);
  back.material.side = THREE.DoubleSide;
  back.name = 'Tub_Back';
  g.add(back);
  g.add(box(0.6, 0.16, 0.58, velvetDark, [0, 0.31, 0.01], 'Seat_Base'));
  for (const x of [-0.24, 0.24]) for (const z of [-0.22, 0.24]) g.add(box(0.025, 0.24, 0.025, brass, [x, 0.12, z], 'Leg'));
  enableShadow(g);
  return g;
}

/** Meja samping bundar Ø 0,6 m, tinggi 0,55 m, dengan vas kecil. */
function sideTablePlaceholder() {
  const g = new THREE.Group();
  g.name = 'Side_Table_Placeholder';
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 36), std(0xf1f5f9, 0.2, 0.05));
  top.position.y = 0.54;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.52, 14), std(0xc9a24a, 0.3, 0.9));
  stem.position.y = 0.27;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.025, 28), std(0xc9a24a, 0.3, 0.9));
  base.position.y = 0.0125;
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.2, 18), std(0x1f4d55, 0.3, 0.1));
  vase.position.set(0.06, 0.65, -0.04);
  const stems = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), std(0x7aa36a, 0.8, 0));
  stems.position.set(0.06, 0.82, -0.04);
  g.add(top, stem, base, vase, stems);
  enableShadow(g);
  return g;
}
