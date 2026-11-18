import * as THREE from 'three';
import { ROOM_WORKSHOP, WORKSHOP, type Spot } from '../layout';
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
import { buildNorthRoomShell } from './northWing';
import { glassWallMats } from './walls';

/**
 * LAYER RUANGAN TAHAP 5: Room_WorkshopTraining, pusat dunia (28.0, 2.0), 6 × 6 m, utara bus.
 *
 * Ruang presentasi / sprint review / tech sharing, sekaligus gerbang ke Collaboration Pods.
 * - Selatan: kaca + bukaan terbuka 1,6 m ke Jalan Utama (selalu memudar).
 * - Utara  : dinding dalam ke Information Wall & Collaboration Pods, bukaan terbuka 1,2 m ke Pods
 *            (selalu memudar: dinding 3,2 m di Z -1 menutupi seluruh baris utara dari kamera).
 * - Barat  : dinding kaca timur Commons (tidak dibangun ulang).
 * - Timur  : dinding luar gedung (memudar dari kamera Tenggara).
 * Panggung di sisi BARAT menghadap Timur: panel kisi walnut, layar 85", podium.
 */
export interface WorkshopSessionInfo {
  topic: string;
  presenter: string;
  role: string;
  attendees: number;
}

export interface WorkshopTraining {
  group: THREE.Group;
  bindWalls: () => void;
  /** 6 kursi peserta (dunia): titik duduk + titik berdiri. */
  seatsWorld: () => Array<{ spot: Spot; approach: Spot }>;
  /** Titik berdiri pembicara di belakang podium (dunia). */
  presenterWorld: () => Spot;
  setSession: (info: WorkshopSessionInfo | null) => void;
  update: (time: number) => void;
  focusPoint: () => THREE.Vector3;
}

export function buildWorkshopTraining(load: ModelLoader, fader: WallFader): WorkshopTraining {
  const shell = buildNorthRoomShell({
    spec: ROOM_WORKSHOP,
    fader,
    fadeId: 'workshop',
    glass: glassWallMats(),
    sides: { west: false },
    interiorSides: [],
    northSegments: [{ id: 'north', xMin: -ROOM_WORKSHOP.halfX, xMax: ROOM_WORKSHOP.halfX, interior: true, doors: ROOM_WORKSHOP.northDoors, openDoors: true }],
  });
  const { group, sub, inner } = shell;
  const floor = sub('SubLayer_Floor');
  const stage = sub('SubLayer_Stage');
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

  // ---- Karpet akustik biru-abu bertenun halus + list oak di tepi ----
  {
    const W = inner.maxX - inner.minX, D = inner.maxZ - inner.minZ, b = 0.1, cx = (inner.minX + inner.maxX) / 2;
    floor.add(meterBox(W - 2 * b, 0.02, D - 2 * b, wovenCarpetMaterial(), [cx, -0.01, 0], 'Workshop_Woven_Carpet'));
    const oak = std(0xb88a5a, 0.55, 0.03);
    const strip = (w: number, d: number, x: number, z: number, n: string) => floor.add(meterBox(w, 0.02, d, oak, [x, -0.01, z], n));
    strip(W, b, cx, inner.minZ + b / 2, 'Oak_Edge_N');
    strip(W, b, cx, inner.maxZ - b / 2, 'Oak_Edge_S');
    strip(b, D - 2 * b, inner.minX + b / 2, 0, 'Oak_Edge_W');
    strip(b, D - 2 * b, inner.maxX - b / 2, 0, 'Oak_Edge_E');
  }

  // ---- Panggung barat: panel latar kisi walnut berdiri sendiri (tidak menutup bagian atas kaca Commons) ----
  {
    const bd = WORKSHOP.backdrop;
    const back = std(0x1b1e21, 0.8, 0.2);
    stage.add(box(0.03, bd.h, bd.w, back, [bd.x - 0.015, bd.h / 2, bd.z], 'Backdrop_Panel'));
    const walnut = std(0x4a2f1c, 0.5, 0.04);
    const n = 30, pitch = bd.w / n;
    for (let i = 0; i < n; i++) stage.add(box(0.025, bd.h - 0.08, pitch * 0.55, walnut, [bd.x + 0.0125, bd.h / 2, bd.z - bd.w / 2 + pitch * (i + 0.5)], 'Walnut_Slat'));
    // Kaki pendek (0,22 m) supaya jalur pembicara di belakang podium (x -2.55) tetap lega.
    for (const z of [bd.z - bd.w / 2 + 0.2, bd.z + bd.w / 2 - 0.2]) stage.add(box(0.22, 0.03, 0.06, std(0x17191c, 0.5, 0.7), [bd.x + 0.07, 0.015, z], 'Backdrop_Foot'));
    const led = box(0.01, 0.012, bd.w - 0.2, new THREE.MeshBasicMaterial({ color: 0xffd9a8 }), [bd.x + 0.03, bd.h - 0.03, bd.z], 'Backdrop_LED');
    led.castShadow = false;
    stage.add(led);
  }

  // ---- Layar 85" (skala 0,88) dengan materi live / demo ----
  const screen = new WorkshopScreen();
  {
    const d = WORKSHOP.display;
    const mount = slot(stage, 'Workshop_Display_85', d.x, d.y, d.z, Math.PI / 2);
    mount.scale.setScalar(d.scale);
    mount.add(screen.mesh);
    mountAsset(slot(mount, 'Display_Model', 0, 0, 0), '/models/Office_Presentation_Display_85.glb', displayPlaceholder(), load, (model) => {
      fitOverlay(mount, model, screen.mesh, 1.86, 1.04, 'Screen_ActiveArea_4K');
    });
  }

  // ---- Podium pembicara ----
  {
    const p = WORKSHOP.podium;
    mountAsset(slot(stage, 'Lectern_Podium', p.x, 0, p.z, p.rotY), '/models/Office_Workshop_Lectern_Podium.glb', podiumPlaceholder(p.w, p.h, p.d), load);
  }

  // ---- 2 meja pelatihan + 6 kursi + buku catatan ----
  {
    const t = WORKSHOP.table;
    WORKSHOP.tables.forEach((p, i) => {
      mountAsset(slot(furniture, `Training_Table_${i}`, p.x, 0, p.z, t.rotY), '/models/Office_Workshop_Training_Table.glb', trainingTablePlaceholder(t.w, t.h, t.d), load);
    });
    const props = slot(furniture, 'Training_Table_Props', 0, t.h, 0);
    WORKSHOP.seats.forEach((s, i) => {
      mountAsset(slot(furniture, `Workshop_Chair_${i}`, s.spot.x, 0, s.spot.z, s.spot.rotY), '/models/Office_Ergonomic_Chair.glb', new THREE.Group(), load);
      const tableX = WORKSHOP.tables[i < 3 ? 0 : 1]!.x;
      const nb = box(0.2, 0.012, 0.27, std([0xe8e2d4, 0x1f4d55, 0xc9973a][i % 3]!, 0.8, 0), [tableX + 0.13, 0.006, s.spot.z], 'Notebook');
      nb.rotation.y = 0.12 * ((i % 2) * 2 - 1);
      props.add(nb);
    });
  }

  // ---- Lampu gantung linear + cahaya ----
  {
    const p = WORKSHOP.pendant;
    mountAsset(slot(decor, 'Linear_Pendant_Workshop', p.x, 0, p.z, p.rotY), '/models/Office_Linear_Pendant_Light.glb', new THREE.Group(), load);
    [-0.8, 0.8].forEach((dz, i) => {
      const l = new THREE.PointLight(0xffe6c8, 8, 5, 1.7);
      l.name = `Workshop_Light_${i}`;
      l.position.set(p.x, 2.15, p.z + dz);
      decor.add(l);
    });
    const stageLight = new THREE.PointLight(0xfff1dc, 6, 4, 1.8);
    stageLight.name = 'Workshop_Stage_Light';
    stageLight.position.set(-1.9, 2.6, 0.6);
    decor.add(stageLight);
  }

  // ---- Tanaman ----
  {
    mountAsset(slot(decor, 'Workshop_Monstera', WORKSHOP.plantNW.x, 0, WORKSHOP.plantNW.z), '/models/Office_Indoor_Plant.glb', new THREE.Group(), load);
    mountAsset(slot(decor, 'Workshop_SnakePlant', WORKSHOP.snakeSE.x, 0, WORKSHOP.snakeSE.z), '/models/Office_Indoor_Plant_SnakePlant.glb', new THREE.Group(), load);
  }

  const toWorldSpot = (p: { x: number; z: number }, rotY = 0): Spot => {
    const v = shell.local(p.x, 0, p.z);
    return { x: v.x, z: v.z, rotY };
  };

  return {
    group,
    bindWalls: shell.bindWalls,
    seatsWorld: () => WORKSHOP.seats.map((s) => ({ spot: toWorldSpot(s.spot, s.spot.rotY), approach: toWorldSpot(s.approach, s.spot.rotY) })),
    presenterWorld: () => toWorldSpot(WORKSHOP.presenter, WORKSHOP.presenter.rotY),
    setSession: (info) => screen.draw(info),
    update: (time) => screen.tick(time),
    focusPoint: () => shell.local(-0.6, 1.05, 0.3),
  };
}

// ============================================================================
// Layar presentasi (kanvas, tanpa API key). Ukuran dasar 1,86 × 1,04 (layar aktif 85").
// ============================================================================
const AGENDA: readonly string[] = ['Arsitektur multi-agen & router gedung', 'Rendering 2.5D dengan Three.js', 'Keamanan run_command & izin CEO', 'Riset pengguna & desain dasbor'];

class WorkshopScreen {
  readonly mesh: THREE.Mesh;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private info: WorkshopSessionInfo | null = null;
  private slide = -1;

  constructor() {
    this.canvas.width = 1024;
    this.canvas.height = 576;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = canvasTexture(this.canvas);
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 1.04), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    this.mesh.name = 'Workshop_Slides_Overlay';
    this.mesh.position.set(0, 0, 0.115);
    this.render();
  }

  draw(info: WorkshopSessionInfo | null) {
    const changed = JSON.stringify(info) !== JSON.stringify(this.info);
    this.info = info;
    if (changed) this.render();
  }

  /** Slide agenda berganti tiap 6 detik saat tidak ada sesi. */
  tick(time: number) {
    const s = Math.floor(time / 6) % AGENDA.length;
    if (!this.info && s !== this.slide) { this.slide = s; this.render(); }
  }

  private render() {
    const c = this.ctx, W = this.canvas.width, H = this.canvas.height, info = this.info;
    const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0b1d2a'); bg.addColorStop(1, '#13324a');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.fillStyle = '#5ed9e7'; c.fillRect(0, 0, W, 8);
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#7dd3fc'; c.font = '600 26px "Inter", system-ui, sans-serif';
    c.fillText('WORKSHOP & TECH DEMO', 48, 70);
    if (info) {
      c.fillStyle = '#f87171'; c.beginPath(); c.arc(W - 220, 61, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fecaca'; c.font = '700 22px "Inter", system-ui, sans-serif'; c.fillText('SESI BERLANGSUNG', W - 200, 69);
      c.fillStyle = '#f8fafc'; c.font = '800 54px "Inter", system-ui, sans-serif';
      let topic = info.topic;
      while (topic.length > 1 && c.measureText(topic).width > W - 96) topic = `${topic.slice(0, -2)}…`;
      c.fillText(topic, 48, 170);
      c.fillStyle = '#cbd5e1'; c.font = '500 30px "Inter", system-ui, sans-serif';
      c.fillText(`Pembicara: ${info.presenter}${info.role ? ` · ${info.role}` : ''}`, 48, 240);
      c.fillText(`Peserta: ${info.attendees}`, 48, 290);
      // Diagram sederhana: 3 kotak tersambung (router → ruangan → agen)
      const boxes = ['Jalan Utama', 'Router gedung', 'Ruangan', 'Agen'];
      boxes.forEach((t, i) => {
        const x = 48 + i * 238, y = 360;
        c.fillStyle = '#16405c'; c.fillRect(x, y, 200, 110);
        c.strokeStyle = '#5ed9e7'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, 198, 108);
        c.fillStyle = '#e2e8f0'; c.font = '600 24px "Inter", system-ui, sans-serif'; c.fillText(t, x + 16, y + 64);
        if (i < boxes.length - 1) { c.fillStyle = '#5ed9e7'; c.fillRect(x + 204, y + 52, 30, 6); }
      });
    } else {
      c.fillStyle = '#f8fafc'; c.font = '800 50px "Inter", system-ui, sans-serif';
      c.fillText('Arsitektur Multi-Agen', 48, 160);
      c.fillStyle = '#94a3b8'; c.font = '500 26px "Inter", system-ui, sans-serif';
      c.fillText('Agenda sesi berikutnya', 48, 220);
      AGENDA.forEach((a, i) => {
        const y = 290 + i * 62, on = i === Math.max(0, this.slide);
        c.fillStyle = on ? '#5ed9e7' : '#334155'; c.fillRect(48, y - 28, 10, 36);
        c.fillStyle = on ? '#f8fafc' : '#94a3b8'; c.font = `${on ? 700 : 500} 30px "Inter", system-ui, sans-serif`;
        c.fillText(a, 78, y);
      });
    }
    c.fillStyle = '#5ed9e7'; c.fillRect(0, H - 6, W, 6);
    this.tex.needsUpdate = true;
  }
}

// ============================================================================
// Tekstur prosedural
// ============================================================================
function rnd(seed: number) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

/** Karpet akustik biru-abu bertenun: anyaman halus, canvas = 1 m. */
function wovenCarpetMaterial() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!, img = x.createImageData(S, S), d = img.data, r = rnd(52);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const weave = ((Math.floor(i / 4) + Math.floor(j / 4)) % 2) * 0.05, v = 0.9 + r() * 0.08 + weave;
    const k = (j * S + i) * 4; d[k] = 78 * v; d[k + 1] = 92 * v; d[k + 2] = 108 * v; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.95, 0, { map: tex });
}

// ============================================================================
// Placeholder prosedural (otomatis diganti GLB bila file-nya ada di public/models)
// ============================================================================
/** Layar 85" sementara (sebelum Office_Presentation_Display_85.glb dimuat). */
function displayPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Display_Placeholder';
  g.add(box(1.9, 1.1, 0.06, std(0x111418, 0.4, 0.6), [0, -0.05, 0.03], 'Display_Body'));
  enableShadow(g);
  return g;
}

/**
 * Podium, kontrak GLB `Office_Workshop_Lectern_Podium`: W 0,62 (X) × H 1,12 × D 0,48 (Z), origin lantai
 * tengah. Muka baca miring menghadap −Z (pembicara), panel depan berlogo menghadap +Z (audiens).
 */
function podiumPlaceholder(w: number, h: number, d: number) {
  const g = new THREE.Group();
  g.name = 'Podium_Placeholder';
  const walnut = std(0x4a2f1c, 0.5, 0.04);
  g.add(box(w, 0.04, d, std(0x17191c, 0.5, 0.7), [0, 0.02, 0], 'Podium_Plinth'));
  g.add(box(w - 0.06, h - 0.16, d - 0.08, walnut, [0, 0.04 + (h - 0.16) / 2, 0.02], 'Podium_Body'));
  const top = box(w, 0.03, d * 0.8, std(0x2a2d31, 0.4, 0.5), [0, h - 0.06, -0.02], 'Podium_Reading_Desk');
  top.rotation.x = -0.28;
  g.add(top);
  g.add(box(w - 0.14, 0.18, 0.01, std(0x5ed9e7, 0.3, 0.2, { emissive: 0x1a6f78, emissiveIntensity: 0.6 }), [0, h * 0.62, d / 2 - 0.015], 'Podium_Logo_Panel'));
  enableShadow(g);
  return g;
}

/**
 * Meja pelatihan, kontrak GLB `Office_Workshop_Training_Table`: W 1,80 (X) × H 0,74 × D 0,55 (Z), origin
 * lantai tengah; modesty panel di −Z, kursi peserta di +Z. Scene memutarnya +90° (kursi di Timur).
 */
function trainingTablePlaceholder(w: number, h: number, d: number) {
  const g = new THREE.Group();
  g.name = 'Training_Table_Placeholder';
  const steel = std(0x17191c, 0.5, 0.75);
  g.add(box(w, 0.03, d, std(0xe9e3d8, 0.45, 0.02), [0, h - 0.015, 0], 'Table_Top'));
  for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) {
    g.add(box(0.05, h - 0.03, 0.05, steel, [x, (h - 0.03) / 2, -d / 2 + 0.1], 'T_Leg_Post'));
    g.add(box(0.05, 0.03, d - 0.06, steel, [x, 0.015, 0], 'T_Leg_Foot'));
  }
  g.add(box(w - 0.2, 0.34, 0.012, std(0x3a3d42, 0.6, 0.4), [0, h - 0.24, -d / 2 + 0.03], 'Modesty_Panel'));
  enableShadow(g);
  return g;
}
