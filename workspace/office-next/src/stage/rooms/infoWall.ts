import * as THREE from 'three';
import { INFOWALL, ROOM_INFOWALL, type Spot } from '../layout';
import type { WallFader } from '../camera/wallFade';
import {
  box,
  canvasTexture,
  enableShadow,
  fitOverlay,
  meterBox,
  mountAsset,
  std,
  type ModelLoader,
} from './assets';
import { buildNorthTierShell } from './northWing';

/**
 * LAYER RUANGAN TAHAP 5: Room_InfoWall, pusat dunia (23.5, -3.0), 5 × 4 m, baris utara kedua.
 *
 * Command-center telemetri tim, diakses dari pintu utara timur Collaboration Commons (dunia X 23).
 * - Utara : dinding luar gedung (solid dari kamera Tenggara) → layar komando panoramik.
 * - Barat : dinding ke Studio / Content (Tahap 6, selalu memudar) → papan kanban ikut memudar.
 * - Timur : partisi ke Collaboration Pods (selalu memudar).
 * - Selatan: dinding utara Commons ruas timur (milik Commons, selalu memudar).
 */
export interface InfoAgentRow {
  name: string;
  status: string;
  /** Warna chip status. */
  tone: 'work' | 'idle' | 'wait' | 'error' | 'meet' | 'away';
  room: string;
}

export interface InfoWallData {
  live: boolean;
  /** Hitungan nyata dari status agen (live) atau state simulasi (demo). */
  counts: { working: number; idle: number; waiting: number; error: number; offline: number; meeting: number };
  /** Riwayat jumlah agen aktif (1 sampel / detik, maks. 60). */
  history: number[];
  rooms: Array<[string, number]>;
  meeting: string | null;
  agents: InfoAgentRow[];
}

export interface InfoWall {
  group: THREE.Group;
  bindWalls: () => void;
  observersWorld: () => Spot[];
  setScreen: (data: InfoWallData) => void;
  focusPoint: () => THREE.Vector3;
}

export function buildInfoWall(load: ModelLoader, fader: WallFader): InfoWall {
  const shell = buildNorthTierShell({ spec: ROOM_INFOWALL, fader, fadeId: 'infowall', interiorSides: ['west', 'east'] });
  const { group, sub, inner, walls } = shell;
  const floor = sub('SubLayer_Floor');
  const av = sub('SubLayer_Command_Display');
  const decor = sub('SubLayer_Decor');
  const slot = (parent: THREE.Object3D, name: string, x: number, y: number, z: number, rotY = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  };

  // ---- Karpet teknis antrasit + garis pemandu cyan di depan zona baca layar ----
  {
    const W = inner.maxX - inner.minX, D = inner.maxZ - inner.minZ;
    floor.add(meterBox(W, 0.02, D, anthraciteCarpet(), [(inner.minX + inner.maxX) / 2, -0.01, (inner.minZ + inner.maxZ) / 2], 'InfoWall_Anthracite_Carpet'));
    const cyan = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (const z of [-0.35, 0.45]) {
      const line = box(3.4, 0.003, 0.02, cyan, [INFOWALL.display.x, 0.0015, z], 'Cyan_Guide_Line');
      line.castShadow = false;
      floor.add(line);
    }
  }

  // ---- Layar komando panoramik + overlay kanvas live ----
  const screen = new InfoWallScreen();
  {
    const d = INFOWALL.display;
    const mount = slot(av, 'Command_Display', d.x, 0, d.z);
    screen.mesh.position.set(0, (d.screen.yMin + d.screen.yMax) / 2, d.screen.z + 0.004);
    screen.mesh.scale.set(d.screen.w / 3.6, (d.screen.yMax - d.screen.yMin) / 1.37, 1);
    mount.add(screen.mesh);
    mountAsset(slot(mount, 'Display_Model', 0, 0, 0), '/models/Office_InfoWall_Command_Display.glb', commandDisplayPlaceholder(d), load, (model) => {
      // Nama mesh layar dari tahap-5-3d-prompts.md (`InfoWall_Main_Screen`); `Command_Screen_Active` juga diterima.
      fitOverlay(mount, model, screen.mesh, 3.6, 1.37, ['InfoWall_Main_Screen', 'Command_Screen_Active']);
    });
    const glow = new THREE.PointLight(0x7dd3fc, 5, 4, 1.8);
    glow.name = 'Command_Display_Glow';
    glow.position.set(d.x, 1.4, d.z + 0.9);
    decor.add(glow);
  }

  // ---- Papan kanban di dinding barat (anak walls.west: ikut memudar saat Studio dibangun) ----
  {
    const k = INFOWALL.kanban;
    // walls.west diputar alongZ; papan dipasang lewat koordinat ruangan lalu di-attach.
    const kslot = slot(group, 'InfoWall_Kanban_Board', k.x, k.y, k.z, k.rotY);   // 'Kanban_Board' sudah dipakai node GLB whiteboard scrum
    // GLB dimuat setelah dinding didaftarkan: segarkan daftar material Auto-Fade dinding barat.
    mountAsset(kslot, '/models/Office_InfoWall_Kanban_Board.glb', kanbanPlaceholder(k.w, k.h, k.d), load, () => fader.refresh('infowall_west'));
    group.updateMatrixWorld(true);
    walls.west.attach(kslot);
  }

  // ---- Snake plant + cahaya ruangan ----
  {
    mountAsset(slot(decor, 'InfoWall_SnakePlant', INFOWALL.snakePlant.x, 0, INFOWALL.snakePlant.z), '/models/Office_Indoor_Plant_SnakePlant.glb', new THREE.Group(), load);
    const l = new THREE.PointLight(0xe8f0ff, 6, 5.5, 1.6);
    l.name = 'InfoWall_Light';
    l.position.set(INFOWALL.light.x, INFOWALL.light.y, INFOWALL.light.z);
    decor.add(l);
  }

  const toWorldSpot = (p: { x: number; z: number }, rotY = 0): Spot => {
    const v = shell.local(p.x, 0, p.z);
    return { x: v.x, z: v.z, rotY };
  };
  return {
    group,
    bindWalls: shell.bindWalls,
    observersWorld: () => INFOWALL.observers.map((o) => toWorldSpot(o, o.rotY)),
    setScreen: (data) => screen.draw(data),
    focusPoint: () => shell.local(0.1, 1.1, 0.2),
  };
}

// ============================================================================
// Layar komando (kanvas, tanpa API key). Ukuran dasar 3,6 × 1,37 m.
// Live: hanya data nyata (status agen, ruangan, rapat). Demo: + angka build contoh berlabel SIMULASI.
// ============================================================================
const TONE: Record<InfoAgentRow['tone'], string> = { work: '#38bdf8', idle: '#94a3b8', wait: '#fbbf24', error: '#f87171', meet: '#c084fc', away: '#475569' };

class InfoWallScreen {
  readonly mesh: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private lastKey = '';

  constructor() {
    this.canvas.width = 1536;
    this.canvas.height = 584;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = canvasTexture(this.canvas);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.37), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    this.mesh.name = 'Command_Screen_Overlay';
    this.draw({ live: false, counts: { working: 0, idle: 0, waiting: 0, error: 0, offline: 0, meeting: 0 }, history: [], rooms: [], meeting: null, agents: [] });
  }

  draw(d: InfoWallData) {
    const key = JSON.stringify(d);
    if (key === this.lastKey) return;
    this.lastKey = key;
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height, font = '"Inter", system-ui, sans-serif';
    c.fillStyle = '#050c12'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#0c2232'; c.fillRect(0, 0, W, 64);
    c.textBaseline = 'middle';
    c.fillStyle = '#e2e8f0'; c.font = `800 30px ${font}`; c.fillText('INFORMATION WALL · LANTAI 1', 28, 33);
    c.fillStyle = d.live ? '#34d399' : '#fbbf24'; c.font = `700 22px ${font}`;
    c.fillText(d.live ? '● LIVE' : '● SIMULASI', W - 170, 33);

    const colW = W / 3, top = 92;
    const head = (x: number, t: string) => { c.fillStyle = '#7dd3fc'; c.font = `700 22px ${font}`; c.fillText(t, x + 24, top); c.fillStyle = '#12303f'; c.fillRect(x + 24, top + 18, colW - 48, 2); };
    // ---- Kolom 1: kesehatan tim ----
    head(0, 'KESEHATAN TIM');
    const k = d.counts;
    const stat = (x: number, y: number, label: string, n: number, color: string) => {
      c.fillStyle = color; c.font = `800 46px ${font}`; c.fillText(String(n), x, y);
      c.fillStyle = '#94a3b8'; c.font = `500 18px ${font}`; c.fillText(label, x, y + 34);
    };
    stat(24, 160, 'bekerja', k.working, '#38bdf8');
    stat(144, 160, 'santai', k.idle, '#cbd5e1');
    stat(264, 160, 'tunggu izin', k.waiting, '#fbbf24');
    stat(24, 250, 'error', k.error, '#f87171');
    stat(144, 250, 'rapat', k.meeting, '#c084fc');
    stat(264, 250, 'offline', k.offline, '#64748b');
    // Grafik agen aktif 60 detik terakhir
    const gx = 24, gy = 330, gw = colW - 48, gh = 120, hist = d.history;
    c.strokeStyle = '#12303f'; c.lineWidth = 1; c.strokeRect(gx, gy, gw, gh);
    c.fillStyle = '#64748b'; c.font = `500 15px ${font}`; c.fillText('agen aktif · 60 dtk', gx + 8, gy - 12);
    if (hist.length > 1) {
      const mx = Math.max(10, ...hist);
      c.beginPath();
      hist.forEach((v, i) => { const x = gx + (i / (hist.length - 1)) * gw, y = gy + gh - (v / mx) * (gh - 10); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
      c.strokeStyle = '#5ed9e7'; c.lineWidth = 3; c.stroke();
    }
    if (d.live) {
      c.fillStyle = '#64748b'; c.font = `500 16px ${font}`;
      c.fillText('Data build & tes ada di panel Inspektur (server).', 24, 500);
    } else {
      c.fillStyle = '#fbbf24'; c.font = `700 16px ${font}`; c.fillText('CONTOH (SIMULASI)', 24, 488);
      c.fillStyle = '#cbd5e1'; c.font = `500 18px ${font}`; c.fillText('Typecheck lulus · 64 tes · pemindai bersih', 24, 518);
    }
    // ---- Kolom 2: zona lantai 1 ----
    head(colW, 'ZONA LANTAI 1');
    // Satu kolom 15 baris (Tahap 6: semua ruangan kecuali foyer): nama kiri, jumlah agen rata kanan.
    d.rooms.slice(0, 15).forEach(([name, n], i) => {
      const x = colW + 24, y = 136 + i * 23, xr = colW * 2 - 24;
      c.fillStyle = n > 0 ? '#e2e8f0' : '#475569'; c.font = `500 17px ${font}`; c.fillText(name, x, y);
      c.fillStyle = n > 0 ? '#38bdf8' : '#334155'; c.font = `700 17px ${font}`; c.textAlign = 'right'; c.fillText(String(n), xr, y); c.textAlign = 'left';
      c.fillStyle = '#0c1c26'; c.fillRect(x, y + 11, xr - x, 1);
    });
    c.fillStyle = d.meeting ? '#c084fc' : '#475569'; c.font = `700 19px ${font}`;
    let meet = d.meeting ? `Rapat: ${d.meeting}` : 'Ruang rapat tersedia';
    while (meet.length > 1 && c.measureText(meet).width > colW - 48) meet = `${meet.slice(0, -2)}…`;
    c.fillText(meet, colW + 24, 512);
    // ---- Kolom 3: aktivitas agen ----
    head(colW * 2, 'AKTIVITAS AGEN');
    d.agents.slice(0, 10).forEach((a, i) => {
      const x = colW * 2 + 24, y = 140 + i * 42;
      c.fillStyle = TONE[a.tone]; c.beginPath(); c.arc(x + 8, y, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e2e8f0'; c.font = `600 19px ${font}`; c.fillText(a.name, x + 26, y);
      c.fillStyle = '#94a3b8'; c.font = `500 17px ${font}`; c.fillText(a.status, x + 150, y);
      c.fillStyle = '#64748b'; c.textAlign = 'right'; c.fillText(a.room, colW * 3 - 24, y); c.textAlign = 'left';
    });
    c.fillStyle = '#38bdf8'; c.fillRect(0, H - 5, W, 5);
    this.tex.needsUpdate = true;
  }
}

// ============================================================================
// Tekstur & placeholder
// ============================================================================
function rnd(seed: number) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

/** Karpet teknis antrasit, canvas = 1 m. */
function anthraciteCarpet() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!, img = x.createImageData(S, S), d = img.data, r = rnd(77);
  for (let i = 0; i < S * S; i++) { const v = 0.9 + r() * 0.12; d[i * 4] = 44 * v; d[i * 4 + 1] = 48 * v; d[i * 4 + 2] = 54 * v; d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.95, 0, { map: tex });
}

/**
 * Layar komando, kontrak GLB `Office_InfoWall_Command_Display`: W 3,80 × H 2,10 × D 0,30, origin = tengah
 * sisi BELAKANG di lantai, layar +Z. Konsol dasar 0,48 m, layar bezelless Y 0,65..2,05; mesh layar aktif
 * bernama `InfoWall_Main_Screen` (atau `Command_Screen_Active`; X ±1,80, Y 0,65..2,02, muka di z ±0,156)
 * ditimpa kanvas scene.
 */
function commandDisplayPlaceholder(d: { w: number; h: number; d: number }) {
  const g = new THREE.Group();
  g.name = 'Command_Display_Placeholder';
  const dark = std(0x111418, 0.4, 0.6);
  g.add(box(d.w, 0.48, d.d, std(0x1b1e21, 0.5, 0.5), [0, 0.24, d.d / 2], 'Base_Console'));
  g.add(box(d.w - 0.1, 0.012, d.d - 0.04, std(0x38bdf8, 0.3, 0.2, { emissive: 0x0e4a63, emissiveIntensity: 0.8 }), [0, 0.486, d.d / 2], 'Console_LED_Strip'));
  g.add(box(d.w - 0.06, 1.45, 0.06, dark, [0, 0.6 + 0.725, 0.12], 'Screen_Panel'));
  g.add(box(0.12, 0.15, 0.1, dark, [-1.2, 0.55, 0.08], 'Mount_Post_L'));
  g.add(box(0.12, 0.15, 0.1, dark, [1.2, 0.55, 0.08], 'Mount_Post_R'));
  enableShadow(g);
  return g;
}

/**
 * Papan kanban, kontrak GLB `Office_InfoWall_Kanban_Board`: W 1,80 (X) × H 1,15 × D 0,06, origin = tengah
 * sisi BELAKANG (y 0 di tengah tinggi papan), muka +Z: kolom Backlog · In Progress · Review · Done.
 */
function kanbanPlaceholder(w: number, h: number, d: number) {
  const g = new THREE.Group();
  g.name = 'Kanban_Placeholder';
  g.add(box(w, h, d * 0.6, std(0x1b1e21, 0.5, 0.5), [0, 0, d * 0.3], 'Board_Frame'));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), new THREE.MeshStandardMaterial({ map: kanbanTexture(), roughness: 0.6 }));
  face.name = 'Kanban_Face';
  face.position.z = d * 0.6 + 0.002;
  g.add(face);
  enableShadow(g);
  return g;
}

function kanbanTexture() {
  const W = 900, H = 560, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d')!, r = rnd(91);
  x.fillStyle = '#f4f6f8'; x.fillRect(0, 0, W, H);
  ['BACKLOG', 'IN PROGRESS', 'REVIEW', 'DONE'].forEach((t, i) => {
    const cx = i * (W / 4);
    x.fillStyle = '#1f2937'; x.font = '700 26px "Inter", system-ui, sans-serif'; x.fillText(t, cx + 18, 40);
    x.fillStyle = '#cbd5e1'; x.fillRect(cx + (W / 4) - 2, 0, 2, H);
    const colors = ['#fde68a', '#bfdbfe', '#fecaca', '#bbf7d0', '#ddd6fe'];
    const n = [5, 3, 2, 4][i]!;
    for (let k = 0; k < n; k++) {
      x.fillStyle = colors[(i + k) % colors.length]!; const y = 70 + k * 92;
      x.fillRect(cx + 16 + r() * 8, y, W / 4 - 40, 76);
      x.fillStyle = 'rgba(31,41,55,0.55)'; x.fillRect(cx + 30, y + 20, (W / 4 - 80) * (0.5 + r() * 0.4), 8); x.fillRect(cx + 30, y + 42, (W / 4 - 80) * (0.3 + r() * 0.4), 8);
    }
  });
  return canvasTexture(c);
}
