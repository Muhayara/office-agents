import * as THREE from 'three';
import { ROOM_SERVER, SERVER, WALL_HEIGHT, type Pt, type Spot } from '../layout';
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
  stdLin,
} from './assets';
import { swingSteelDoor } from './doors';
import { buildSouthRoomShell } from './southWing';
import { glassWallMats, type SolidWallMaterials } from './walls';

/**
 * LAYER RUANGAN TAHAP 3: Room_ServerIT, pusat dunia (20.0, 10.4), 4 × 6 m.
 *
 * Ruang utilitas teknis: menuntaskan relokasi 2× Server Rack 42U dari Ruang Kerja.
 * - Utara : partisi akustik penuh + pintu baja berjendela intip (berayun otomatis) + keypad RFID.
 * - Barat / Timur: dinding dalam ke calon Focus Pods (Tahap 6) & Digital Garden (Tahap 4).
 * - Barat (muka): CRAC & layar NOC menghadap Timur (terlihat dari kamera Tenggara).
 * - Lantai: raised access floor 60 × 60 cm, ubin grille berlubang di cold aisle.
 */
export interface ServerRoom {
  group: THREE.Group;
  bindWalls: () => void;
  inspectWorld: () => Spot;
  consoleSeatWorld: () => { spot: Spot; approach: Spot };
  /** `screenVisible` = ruangan terlihat kamera (false: layar NOC tidak digambar ulang). */
  update: (time: number, dt: number, agents: readonly Pt[], screenVisible?: boolean) => void;
  focusPoint: () => THREE.Vector3;
}

/** Panel akustik abu-abu metalik untuk dinding Server / IT. */
function acousticWallMats(): SolidWallMaterials {
  const metal = stdLin([0.06, 0.065, 0.07], 0.35, 0.75);
  return {
    body: stdLin([0.105, 0.112, 0.12], 0.6, 0.45),
    base: stdLin([0.03, 0.032, 0.035], 0.6, 0.4),
    cap: metal,
    frame: stdLin([0.035, 0.038, 0.042], 0.35, 0.8),
    threshold: metal,
  };
}

export function buildServerRoom(load: ModelLoader, fader: WallFader): ServerRoom {
  const mats = acousticWallMats();
  const shell = buildSouthRoomShell({
    spec: ROOM_SERVER,
    fader,
    fadeId: 'server',
    glass: glassWallMats(),
    solid: mats,
    north: 'solid',
    interiorSides: ['west', 'east'],
  });
  const { group, sub, inner, walls } = shell;
  const floor = sub('SubLayer_RaisedFloor');
  const it = sub('SubLayer_IT_Equipment');
  const decor = sub('SubLayer_Safety_Decor');

  const slot = (parent: THREE.Group, name: string, x: number, y: number, z: number, rotY = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  };

  // ---- Raised access floor 60 × 60 + ubin grille berlubang di depan rak (cold aisle) ----
  {
    const W = inner.maxX - inner.minX, D = inner.maxZ - inner.minZ;
    floor.add(meterBox(W, 0.02, D, raisedFloorMaterial(), [0, -0.01, 0], 'Raised_Access_Floor'));
    const grille = grilleMaterial();
    [-0.6, 0, 0.6].forEach((x, i) => {
      const g = meterBox(0.58, 0.004, 0.58, grille, [x, 0.002, 0.3], `Air_Grille_Tile_${i}`);
      floor.add(g);
    });
  }

  // ---- Panel akustik di muka dalam dinding selatan / barat / timur (ikut memudar) ----
  {
    const panels = acousticPanelMaterial();
    const h = WALL_HEIGHT - 0.3;
    walls.south.add(meterBox(inner.maxX - inner.minX - 0.1, h, 0.03, panels, [0, 0.15 + h / 2, inner.maxZ - 0.015], 'Acoustic_Panels_S'));
    // Dinding samping dibangun memanjang X lalu diputar (alongZ): muka dalam barat = sisi "north" (-Z lokal dinding).
    const sideLen = inner.maxZ - inner.minZ - 0.1;
    walls.west.add(meterBox(sideLen, h, 0.03, panels, [0, 0.15 + h / 2, -0.12 - 0.015], 'Acoustic_Panels_W'));
    walls.east.add(meterBox(sideLen, h, 0.03, panels, [0, 0.15 + h / 2, 0.12 + 0.015], 'Acoustic_Panels_E'));
  }

  // ---- 2× Server Rack 42U (pindahan resmi dari Ruang Kerja) ----
  // Optimasi 3D: LED status cukup emissive bawaan GLB rak (PointLight LED berdenyut dihapus).
  SERVER.racks.forEach((r, i) => {
    mountAsset(slot(it, `ServerRack_${i}`, r.x, 0, r.z), '/models/Server_Rack_42U.glb', rackPlaceholder(), load);
  });

  // ---- Tray kabel fiber di atas rak, menuju dinding utara ----
  {
    const trayMat = std(0x8a929a, 0.4, 0.8);
    const fiber = std(0xf2c230, 0.5, 0.05);
    const y = 2.42, z0 = inner.minZ + 0.05, z1 = SERVER.racks[0]!.z + 0.25;
    const len = z1 - z0, cz = (z0 + z1) / 2;
    it.add(box(0.025, 0.06, len, trayMat, [-0.16, y, cz], 'Cable_Tray_Rail_W'));
    it.add(box(0.025, 0.06, len, trayMat, [0.16, y, cz], 'Cable_Tray_Rail_E'));
    for (let z = z0 + 0.1; z < z1; z += 0.3) it.add(box(0.32, 0.015, 0.025, trayMat, [0, y - 0.025, z], 'Cable_Tray_Rung'));
    it.add(box(0.22, 0.05, len, fiber, [0, y - 0.005, cz], 'Fiber_Duct_Yellow'));
    SERVER.racks.forEach((r, i) => {
      it.add(box(0.06, y - 2.05, 0.06, fiber, [r.x * 0.6, (2.05 + y) / 2, z1 - 0.05], `Fiber_Drop_${i}`));
    });
    [-0.16, 0.16].forEach((x, i) => it.add(box(0.02, WALL_HEIGHT - y, 0.02, trayMat, [x, (y + WALL_HEIGHT) / 2, cz], `Tray_Hanger_${i}`)));
  }

  // ---- Unit AC presisi (CRAC) di dinding barat, menghadap Timur ----
  {
    const c = SERVER.crac;
    mountAsset(slot(it, 'CRAC_Precision_Cooling', c.x, 0, c.z, c.rotY), '/models/Office_Server_CRAC_Unit.glb', cracPlaceholder(c.w, c.d, c.h), load);
  }

  // ---- Layar NOC 55" di dinding barat (grafik throughput, uptime, keamanan) ----
  const noc = new NocScreen();
  {
    const n = SERVER.noc;
    const mount = slot(it, 'NOC_Display_55', n.x, n.y, n.z, Math.PI / 2);
    mount.scale.setScalar(n.scale);
    mount.add(noc.mesh);
    mountAsset(slot(mount, 'Display_Model', 0, 0, 0), '/models/Office_Presentation_Display_85.glb', new THREE.Group(), load, (model) => {
      let active: THREE.Object3D | undefined = model.getObjectByName('Screen_ActiveArea_4K');
      if (!active) model.traverse((o) => { if (!active && (o as THREE.Mesh).isMesh && /screen/i.test(o.name)) active = o; });
      if (!active) return;
      mount.updateWorldMatrix(true, true);
      const bb = new THREE.Box3().setFromObject(active);
      const lo = new THREE.Vector3(Infinity, Infinity, Infinity), hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        const p = mount.worldToLocal(new THREE.Vector3(x, y, z));
        lo.min(p); hi.max(p);
      }
      const w = hi.x - lo.x, h = hi.y - lo.y;
      if (w > 0.2 && h > 0.2) {
        noc.mesh.position.set((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, hi.z + 0.006);
        noc.mesh.scale.set(w / 1.86, h / 1.04, 1);
      }
    });
  }

  // ---- Konsol meja IT admin (monitor ganda) + kursi putar ----
  {
    const c = SERVER.console;
    mountAsset(slot(it, 'IT_Admin_Console', c.x, 0, c.z, c.rotY), '/models/Office_Server_Admin_Console.glb', consolePlaceholder(c.w, c.d), load);
    const s = SERVER.consoleSeat.spot;
    mountAsset(slot(it, 'IT_Console_Chair', s.x, 0, s.z, s.rotY), '/models/Office_Ergonomic_Chair.glb', new THREE.Group(), load);
  }

  // ---- Keselamatan: tabung pemadam clean agent + kotak P3K di samping pintu ----
  {
    const e = SERVER.extinguisher;
    const ext = slot(decor, 'Clean_Agent_Extinguisher', e.x, 0, e.z);
    const red = std(0xc81e1e, 0.35, 0.3);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.55, 20), red);
    body.position.y = 0.36;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), red);
    dome.position.y = 0.635;
    const valve = box(0.05, 0.08, 0.05, std(0x1a1a1a, 0.4, 0.6), [0, 0.74, 0], 'Valve');
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 16), std(0xf1f1f1, 0.3, 0.2));
    gauge.rotation.x = Math.PI / 2; gauge.position.set(0, 0.74, 0.035);
    const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.02, 0.74, 0), new THREE.Vector3(0.1, 0.6, 0.02), new THREE.Vector3(0.1, 0.35, 0.03)]), 12, 0.009, 6), std(0x111111, 0.6, 0.1));
    const stand = box(0.24, 0.12, 0.2, std(0x2a2f34, 0.5, 0.6), [0, 0.06, 0], 'Floor_Stand');
    const label = box(0.1, 0.16, 0.004, std(0xf5f5f5, 0.6, 0), [0, 0.38, 0.086], 'Label');
    ext.add(body, dome, valve, gauge, hose, stand, label);
    enableShadow(ext);
    const f = SERVER.firstAid;
    const aid = slot(decor, 'First_Aid_Kit', f.x, f.y, f.z);
    aid.add(box(0.36, 0.28, 0.1, std(0xf4f4f2, 0.5, 0.05), [0, 0, 0], 'Kit_Box'));
    aid.add(box(0.06, 0.18, 0.005, std(0x16a34a, 0.5, 0), [0, 0, 0.052], 'Cross_V'));
    aid.add(box(0.18, 0.06, 0.005, std(0x16a34a, 0.5, 0), [0, 0, 0.052], 'Cross_H'));
    enableShadow(aid);
  }

  // ---- Lampu putih dingin (scene tanpa plafon: tidak ada armatur melayang) ----
  {
    const l = SERVER.light;
    const lamp = lightAnchor(0xdbeafe, 10, 6, 1.6);
    lamp.name = 'Server_Cool_Light';
    lamp.position.set(l.x, l.y, l.z);
    decor.add(lamp);
  }

  // ---- Pintu baja berayun otomatis + keypad RFID (bagian dinding utara: ikut memudar) ----
  const door = swingSteelDoor({ name: 'Server_Steel_Door', span: ROOM_SERVER.northDoor, wallZ: -ROOM_SERVER.halfZ + 0.12, sense: SERVER.doorSense, parent: group });
  walls.north.add(door.group);

  const toWorld = (p: { x: number; z: number }, rotY: number): Spot => {
    const v = shell.local(p.x, 0, p.z);
    return { x: v.x, z: v.z, rotY };
  };
  let nocT = 0;

  return {
    group,
    bindWalls: shell.bindWalls,
    inspectWorld: () => toWorld(SERVER.inspect, SERVER.inspect.rotY),
    consoleSeatWorld: () => ({
      spot: toWorld(SERVER.consoleSeat.spot, SERVER.consoleSeat.spot.rotY),
      approach: toWorld(SERVER.consoleSeat.approach, SERVER.consoleSeat.spot.rotY),
    }),
    update: (time, dt, agents, screenVisible = true) => {
      door.update(dt, agents);
      // Optimasi 3D: kanvas NOC tidak digambar ulang (dan tidak diunggah ke GPU) saat ruangan di luar kamera.
      if (screenVisible && time - nocT > 0.5) { nocT = time; noc.draw(time); }
    },
    focusPoint: () => shell.local(0, 1.05, 0.4),
  };
}

// ============================================================================
// Layar NOC (kanvas animasi, tanpa API key). Ukuran dasar 1,86 × 1,04 (sama dengan TV).
// ============================================================================
class NocScreen {
  readonly mesh: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private samples: number[] = [];
  private seed = 3;

  constructor() {
    this.canvas.width = 768;
    this.canvas.height = 430;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = canvasTexture(this.canvas);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 1.04), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    this.mesh.name = 'NOC_Screen';
    this.mesh.position.set(0, -0.055, 0.09);
    for (let i = 0; i < 60; i++) this.samples.push(this.next());
    this.draw(0);
  }

  private next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    const r = this.seed / 233280;
    const last = this.samples[this.samples.length - 1] ?? 0.55;
    return Math.max(0.15, Math.min(0.95, last + (r - 0.5) * 0.18));
  }

  draw(time: number) {
    this.samples.push(this.next());
    if (this.samples.length > 60) this.samples.shift();
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height;
    c.fillStyle = '#050d12'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#0b2230'; c.fillRect(0, 0, W, 56);
    c.textBaseline = 'middle';
    c.fillStyle = '#e2e8f0'; c.font = '700 28px "Inter", system-ui, sans-serif';
    c.fillText('NOC · MONITORING SERVER', 24, 29);
    c.fillStyle = '#34d399'; c.font = '600 18px "Inter", system-ui, sans-serif';
    c.fillText('● SEMUA SISTEM NORMAL', W - 250, 30);
    // Grafik throughput jaringan
    const gx = 24, gy = 82, gw = 470, gh = 210;
    c.strokeStyle = '#12303f'; c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const y = gy + (gh * i) / 4; c.beginPath(); c.moveTo(gx, y); c.lineTo(gx + gw, y); c.stroke(); }
    c.fillStyle = '#94a3b8'; c.font = '500 16px "Inter", system-ui, sans-serif';
    c.fillText('Throughput jaringan (Gbps)', gx, gy - 12);
    const grad = c.createLinearGradient(0, gy, 0, gy + gh);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.45)'); grad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
    c.beginPath(); c.moveTo(gx, gy + gh);
    this.samples.forEach((v, i) => c.lineTo(gx + (gw * i) / (this.samples.length - 1), gy + gh - v * gh));
    c.lineTo(gx + gw, gy + gh); c.closePath(); c.fillStyle = grad; c.fill();
    c.beginPath();
    this.samples.forEach((v, i) => { const x = gx + (gw * i) / (this.samples.length - 1), y = gy + gh - v * gh; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.strokeStyle = '#38bdf8'; c.lineWidth = 3; c.stroke();
    const now = this.samples[this.samples.length - 1]!;
    c.fillStyle = '#e2e8f0'; c.font = '700 24px "Inter", system-ui, sans-serif';
    c.fillText(`${(now * 9.6).toFixed(1)} Gbps`, gx + gw - 120, gy + 18);
    // Panel status kanan
    const px = 520, rows: Array<[string, string, string]> = [
      ['Uptime', '99,98%', '#34d399'],
      ['Rak A · B', '2 / 2 online', '#34d399'],
      ['Suhu CRAC', '18,0 °C', '#7dd3fc'],
      ['Database', 'replika sehat', '#34d399'],
      ['Ancaman', '0 aktif', '#34d399'],
    ];
    rows.forEach(([k, v, col], i) => {
      const y = 92 + i * 46;
      c.fillStyle = '#0b1f2a'; c.fillRect(px, y - 18, W - px - 24, 38);
      c.fillStyle = '#94a3b8'; c.font = '500 16px "Inter", system-ui, sans-serif'; c.fillText(k, px + 12, y);
      c.fillStyle = col; c.font = '700 18px "Inter", system-ui, sans-serif'; c.textAlign = 'right'; c.fillText(v, W - 36, y); c.textAlign = 'left';
    });
    c.fillStyle = '#64748b'; c.font = '400 16px "Inter", system-ui, sans-serif';
    const secs = Math.floor(time);
    c.fillText(`Log keamanan diperbarui ${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')} lalu · scanner Satria aktif`, 24, 330);
    c.fillStyle = '#38bdf8'; c.fillRect(0, H - 6, W, 6);
    this.tex.needsUpdate = true;
  }
}

// ============================================================================
// Tekstur prosedural
// ============================================================================
/** Raised access floor: ubin 60 cm abu-abu muda, nat gelap, canvas = 1,2 m. */
function raisedFloorMaterial() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#b9bfc4'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) { x.fillStyle = i % 3 === 0 ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)'; x.fillRect((i % 2) * S / 2, Math.floor(i / 2) * S / 2, S / 2, S / 2); }
  x.strokeStyle = '#4b535a'; x.lineWidth = 3;
  [0, S / 2].forEach((p) => { x.beginPath(); x.moveTo(p, 0); x.lineTo(p, S); x.stroke(); x.beginPath(); x.moveTo(0, p); x.lineTo(S, p); x.stroke(); });
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 1.2, 1 / 1.2);
  return std(0xffffff, 0.55, 0.15, { map: tex });
}

/** Ubin grille berlubang (aliran udara dingin), canvas = 0,6 m. */
function grilleMaterial() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#9aa2a8'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#2b3136';
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) x.fillRect(10 + i * 15, 10 + j * 15, 9, 9);
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 0.6, 1 / 0.6);
  return std(0xffffff, 0.45, 0.6, { map: tex });
}

/** Panel akustik persegi 60 cm abu-abu metalik dengan alur, canvas = 1,2 m. */
function acousticPanelMaterial() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#3d444b'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) {
    const ox = (i % 2) * S / 2, oy = Math.floor(i / 2) * S / 2;
    x.fillStyle = i % 2 ? '#434b52' : '#3a4147'; x.fillRect(ox + 3, oy + 3, S / 2 - 6, S / 2 - 6);
    x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1;
    for (let k = 1; k < 8; k++) { x.beginPath(); x.moveTo(ox + 3, oy + k * S / 16); x.lineTo(ox + S / 2 - 3, oy + k * S / 16); x.stroke(); }
  }
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / 1.2, 1 / 1.2);
  return std(0xffffff, 0.8, 0.35, { map: tex });
}

// ============================================================================
// Placeholder prosedural (otomatis diganti GLB bila file-nya ada di public/models)
// ============================================================================
function rackPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Rack_Placeholder';
  g.add(box(0.75, 2.05, 0.95, std(0x111418, 0.4, 0.6), [0, 1.025, 0], 'Rack_Body'));
  enableShadow(g);
  return g;
}

/** CRAC presisi: kabinet tinggi, grille hisap atas & bawah, panel layar suhu. Origin = belakang-bawah-tengah, depan = +Z. */
function cracPlaceholder(w: number, d: number, h: number) {
  const root = new THREE.Group();
  root.name = 'CRAC_Placeholder';
  const g = new THREE.Group();
  g.position.z = d / 2;
  root.add(g);
  const body = std(0xd5d9dc, 0.45, 0.35);
  const grille = std(0x30363b, 0.6, 0.5);
  g.add(box(w, h, d, body, [0, h / 2, 0], 'CRAC_Cabinet'));
  g.add(box(w - 0.1, 0.45, 0.01, grille, [0, h - 0.33, d / 2 + 0.003], 'Return_Air_Grille'));
  g.add(box(w - 0.1, 0.35, 0.01, grille, [0, 0.3, d / 2 + 0.003], 'Supply_Air_Grille'));
  for (let k = 0; k < 6; k++) g.add(box(w - 0.12, 0.012, 0.012, std(0x8a9399, 0.4, 0.7), [0, h - 0.5 + k * 0.07, d / 2 + 0.01], 'Louver'));
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = '#04121a'; x.fillRect(0, 0, 128, 64);
  x.fillStyle = '#7dd3fc'; x.font = '700 30px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('18.0°C', 64, 34);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ map: canvasTexture(c), toneMapped: false }));
  screen.position.set(0, h - 0.75, d / 2 + 0.006);
  g.add(screen);
  g.add(box(0.06, 0.06, 0.01, std(0x16a34a, 0.4, 0, { emissive: 0x22c55e, emissiveIntensity: 1.2 }), [0.18, h - 0.75, d / 2 + 0.006], 'Status_LED'));
  enableShadow(root);
  return root;
}

/**
 * Konsol IT admin: meja teknis 1,4 × 0,7 m, monitor ganda dengan grafik throughput / keamanan,
 * keyboard & mouse. Origin = belakang-bawah-tengah, sisi pengguna = +Z.
 */
function consolePlaceholder(w: number, d: number) {
  const root = new THREE.Group();
  root.name = 'IT_Console_Placeholder';
  const g = new THREE.Group();
  g.position.z = d / 2;
  root.add(g);
  const top = std(0x2f363c, 0.45, 0.4);
  const steel = std(0x1c2226, 0.45, 0.75);
  g.add(box(w, 0.035, d, top, [0, 0.737, 0], 'Desk_Top'));
  for (const x of [-w / 2 + 0.04, w / 2 - 0.04]) g.add(box(0.04, 0.72, d - 0.08, steel, [x, 0.36, 0], 'Leg_Panel'));
  g.add(box(w - 0.1, 0.3, 0.02, steel, [0, 0.5, -d / 2 + 0.05], 'Modesty_Panel'));
  const screenTex = (title: string, color: string, seed: number) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 144;
    const x = c.getContext('2d')!;
    x.fillStyle = '#050d12'; x.fillRect(0, 0, 256, 144);
    x.fillStyle = '#94a3b8'; x.font = '600 14px "Inter", system-ui, sans-serif'; x.fillText(title, 10, 18);
    x.strokeStyle = color; x.lineWidth = 2; x.beginPath();
    let s = seed;
    for (let i = 0; i <= 24; i++) { s = (s * 9301 + 49297) % 233280; const y = 120 - (s / 233280) * 80; if (i) x.lineTo(10 + i * 10, y); else x.moveTo(10, y); }
    x.stroke();
    return canvasTexture(c);
  };
  [[-0.3, 'Throughput', '#38bdf8', 11], [0.3, 'Keamanan DB', '#34d399', 29]].forEach(([dx, title, col, seed], i) => {
    const mon = box(0.52, 0.31, 0.03, std(0x0b0f12, 0.3, 0.4), [dx as number, 0.98, -0.12], `Monitor_${i}`);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.49, 0.28), new THREE.MeshBasicMaterial({ map: screenTex(title as string, col as string, seed as number), toneMapped: false }));
    scr.position.set(dx as number, 0.98, -0.104);
    const arm = box(0.04, 0.2, 0.04, steel, [dx as number, 0.85, -0.16], `Monitor_Stand_${i}`);
    mon.rotation.y = scr.rotation.y = (i ? -1 : 1) * 0.12;
    g.add(mon, scr, arm);
  });
  g.add(box(0.4, 0.015, 0.13, std(0x15181b, 0.6, 0.2), [0, 0.762, 0.1], 'Keyboard'));
  g.add(box(0.06, 0.02, 0.09, std(0x15181b, 0.5, 0.2), [0.3, 0.765, 0.1], 'Mouse'));
  enableShadow(root);
  return root;
}
