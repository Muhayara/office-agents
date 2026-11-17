import * as THREE from 'three';
import { ROOM_FOYER, WALL_HEIGHT, WALL_THICKNESS } from '../layout';
import type { WallFader } from '../camera/wallFade';
import {
  box,
  canvasTexture,
  createCarpetFloor,
  enableShadow,
  mountAsset,
  std,
  stdLin,
  type ModelLoader,
} from './assets';
import type { MeetingScreenInfo } from './boardroom';
import { boardroomWallMats, buildSolidWallX } from './walls';

/**
 * LAYER RUANG TRANSISI: Room_MeetingFoyer (Tahap 1), pusat dunia (11.0, 4.0), 8 × 2 m.
 *
 * Ruang terbuka di depan ruang rapat: jalur tengah 2,4 m (lokal X -1.2..1.2) lurus dari
 * pintu Jalan Utama ke pintu ruang rapat, TANPA sekat ke sayap kiri/kanan.
 * - Utara  : dinding selatan ruang rapat (milik Room_Boardroom_10p).
 * - Barat  : sekat kaca ruang kerja (milik office_room_shell.glb).
 * - Timur  : curb cutaway rendah, sampai Collaboration Commons dibangun (Tahap 4).
 * - Selatan: dinding penuh berpintu tengah ke Jalan Utama (dibangun di sini).
 */
export interface MeetingFoyer {
  group: THREE.Group;
  setCarpetMaterial: (mat: THREE.MeshStandardMaterial) => void;
  /** Daftarkan dinding ke Auto-Fade setelah ruangan dipasang di hierarki gedung. */
  bindWalls: () => void;
  /** Papan status ruang rapat di sayap timur (null = ruang tersedia). */
  setStatus: (info: MeetingScreenInfo | null) => void;
  focusPoint: () => THREE.Vector3;
}

export function buildMeetingFoyer(load: ModelLoader, fader: WallFader): MeetingFoyer {
  const group = new THREE.Group();
  group.name = ROOM_FOYER.name;
  group.position.set(ROOM_FOYER.origin.x, 0, ROOM_FOYER.origin.z);

  const sub = (name: string) => {
    const g = new THREE.Group();
    g.name = name;
    group.add(g);
    return g;
  };
  const architecture = sub('SubLayer_Architecture');
  const decor = sub('SubLayer_Decor');
  const signage = sub('SubLayer_Signage');

  const W = ROOM_FOYER.halfX * 2;
  const D = ROOM_FOYER.halfZ * 2;

  // ---- Lantai: sub-slab slate + karpet yang sama dengan ruang rapat ----
  const slab = box(W, 0.28, D, stdLin([0.009, 0.019, 0.024], 0.9, 0), [0, -0.16, 0], 'Foyer_SubSlab');
  slab.castShadow = false;
  architecture.add(slab);
  const carpet = createCarpetFloor(W, D, [0, -0.01, 0], 'Foyer_Acoustic_Carpet');
  architecture.add(carpet.mesh);

  // ---- Dinding selatan + pintu tengah ke Jalan Utama ----
  const southZ = ROOM_FOYER.southWallZ;
  const southWall = buildSolidWallX({
    name: 'South_Wall',
    xMin: -ROOM_FOYER.halfX,
    xMax: ROOM_FOYER.halfX,
    z: southZ,
    doors: [ROOM_FOYER.southDoor],
    mats: boardroomWallMats(),
    bodyHeight: WALL_HEIGHT - 0.02,
    cap: { width: 0.26, yMin: WALL_HEIGHT - 0.02, yMax: WALL_HEIGHT },
    base: { height: 0.28, north: 0.025, south: 0.025 },
    threshold: { zMin: southZ - WALL_THICKNESS / 2, zMax: ROOM_FOYER.halfZ, yMin: 0, yMax: 0.003 },
  });
  architecture.add(southWall);

  // ---- Sisi timur: curb cutaway, menyambung Curb_East ruang rapat ----
  const innerZ = southZ - WALL_THICKNESS / 2;
  const curbLen = innerZ + ROOM_FOYER.halfZ;
  const curb = box(
    0.24, 0.13, curbLen,
    stdLin([0.004, 0.009, 0.011], 0.6, 0.55),
    [ROOM_FOYER.halfX - 0.12, 0.065, (innerZ - ROOM_FOYER.halfZ) / 2],
    'Curb_East',
  );
  curb.castShadow = false;
  architecture.add(curb);

  // ---- Sayap barat: meja konsol minuman rapat + monstera ----
  const consoleSlot = new THREE.Group();
  consoleSlot.name = 'Foyer_Console_Drinks';
  consoleSlot.position.set(-2.6, 0, -0.74);
  consoleSlot.add(consolePlaceholder());
  decor.add(consoleSlot);

  const plant = (url: string, name: string, x: number, z: number, s: number) => {
    const slot = new THREE.Group();
    slot.name = name;
    slot.position.set(x, 0, z);
    slot.scale.setScalar(s);
    decor.add(slot);
    mountAsset(slot, url, new THREE.Group(), load);
  };
  plant('/models/Office_Indoor_Plant.glb', 'Foyer_Monstera', -3.4, 0.32, 0.85);

  // ---- Sayap timur: bangku tunggu + snake plant ----
  const benchSlot = new THREE.Group();
  benchSlot.name = 'Foyer_Waiting_Bench';
  benchSlot.position.set(2.35, 0, 0.48);
  benchSlot.add(benchPlaceholder());
  decor.add(benchSlot);
  plant('/models/Office_Indoor_Plant_SnakePlant.glb', 'Foyer_SnakePlant', 3.4, -0.55, 0.9);

  // ---- Papan status ruang rapat (menempel muka selatan dinding ruang rapat) ----
  const sign = new RoomSign();
  sign.root.position.set(2.2, 1.62, -ROOM_FOYER.halfZ + 0.003);
  signage.add(sign.root);
  sign.draw(null);

  const local = (x: number, y: number, z: number) => {
    group.updateWorldMatrix(true, false);
    return group.localToWorld(new THREE.Vector3(x, y, z));
  };

  return {
    group,
    setCarpetMaterial: carpet.applyMaterial,
    bindWalls: () => {
      group.updateWorldMatrix(true, true);
      const s = new THREE.Vector3(0, 0, -1).transformDirection(group.matrixWorld);
      fader.register('foyer_south', [southWall], s, local(0, 0, innerZ), { interior: true });
    },
    setStatus: (info) => sign.draw(info),
    focusPoint: () => local(0, 1.05, 0),
  };
}

// ============================================================================
// Papan status ruang rapat (kanvas, tanpa API key)
// ============================================================================
class RoomSign {
  readonly root = new THREE.Group();
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private lastKey = '';

  constructor() {
    this.root.name = 'Boardroom_Status_Sign';
    this.canvas.width = 512;
    this.canvas.height = 288;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = canvasTexture(this.canvas);
    const frame = box(0.98, 0.58, 0.03, stdLin([0.019, 0.025, 0.03], 0.38, 0.85), [0, 0, 0.015], 'Sign_Frame');
    frame.castShadow = false;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.506),
      new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }),
    );
    face.name = 'Sign_Display';
    face.position.z = 0.032;
    this.root.add(frame, face);
  }

  draw(info: MeetingScreenInfo | null) {
    const key = info ? `${info.phase}|${info.topic}|${info.seated}|${info.total}` : 'free';
    if (key === this.lastKey) return;
    this.lastKey = key;
    const c = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    c.fillStyle = '#07141c';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#0f2a38';
    c.fillRect(0, 0, W, 58);
    c.textBaseline = 'middle';
    c.fillStyle = '#e2e8f0';
    c.font = '700 30px "Inter", system-ui, sans-serif';
    c.fillText('RUANG RAPAT', 24, 30);
    c.fillStyle = '#7dd3fc';
    c.font = '500 20px "Inter", system-ui, sans-serif';
    c.fillText('10 kursi', W - 108, 31);

    const color = !info ? '#34d399' : info.phase === 'session' ? '#f87171' : '#fbbf24';
    const label = !info ? 'TERSEDIA' : info.phase === 'session' ? 'SEDANG RAPAT' : 'MENUNGGU PESERTA';
    c.fillStyle = color;
    c.beginPath();
    c.arc(44, 112, 16, 0, Math.PI * 2);
    c.fill();
    c.font = '700 38px "Inter", system-ui, sans-serif';
    c.fillText(label, 74, 114);

    c.fillStyle = '#94a3b8';
    c.font = '400 22px "Inter", system-ui, sans-serif';
    if (!info) {
      c.fillText('Kirim /rapat <topik> untuk memanggil tim.', 24, 182);
      c.fillText('Masuk lewat pintu tengah foyer.', 24, 222);
    } else {
      let topic = info.topic.replace(/\s+/g, ' ').trim();
      while (topic.length > 1 && c.measureText(topic).width > W - 48) topic = `${topic.slice(0, -2)}…`;
      c.fillStyle = '#f8fafc';
      c.fillText(topic, 24, 182);
      c.fillStyle = '#94a3b8';
      c.fillText(`Peserta hadir: ${info.seated}/${info.total}`, 24, 222);
    }
    c.fillStyle = color;
    c.fillRect(0, H - 8, W, 8);
    this.tex.needsUpdate = true;
  }
}

// ============================================================================
// Perabot ringan prosedural
// ============================================================================
function consolePlaceholder() {
  const g = new THREE.Group();
  g.name = 'Foyer_Console_Placeholder';
  const steel = std(0x14181c, 0.35, 0.8);
  const walnut = std(0x3d2314, 0.45, 0.05);
  g.add(box(1.4, 0.04, 0.38, walnut, [0, 0.84, 0], 'Console_Top'));
  g.add(box(1.3, 0.02, 0.3, walnut, [0, 0.26, 0], 'Console_Shelf'));
  for (const x of [-0.66, 0.66]) for (const z of [-0.15, 0.15]) g.add(box(0.03, 0.82, 0.03, steel, [x, 0.41, z]));
  for (const x of [-0.66, 0.66]) g.add(box(0.03, 0.03, 0.3, steel, [x, 0.8, 0]));

  // Baki minuman: karaf + gelas untuk rapat panjang
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe8ee, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.45 });
  g.add(box(0.46, 0.015, 0.28, std(0xaab2b8, 0.3, 0.85), [-0.35, 0.8675, 0], 'Serving_Tray'));
  const carafe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.24, 16), glass);
  carafe.position.set(-0.48, 0.995, 0);
  g.add(carafe);
  for (let i = 0; i < 4; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.09, 12), glass);
    cup.position.set(-0.34 + (i % 2) * 0.09, 0.92, -0.05 + Math.floor(i / 2) * 0.1);
    g.add(cup);
  }
  // Tumpukan agenda rapat
  g.add(box(0.24, 0.03, 0.32, std(0xe2e8f0, 0.7, 0), [0.4, 0.875, 0], 'Agenda_Stack'));
  enableShadow(g);
  return g;
}

function benchPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Foyer_Bench_Placeholder';
  const steel = std(0x14181c, 0.35, 0.8);
  g.add(box(1.3, 0.06, 0.42, std(0x3d2314, 0.5, 0.05), [0, 0.43, 0], 'Bench_Seat'));
  g.add(box(1.2, 0.05, 0.36, std(0x222225, 0.85, 0), [0, 0.485, 0], 'Bench_Cushion'));
  for (const x of [-0.56, 0.56]) {
    g.add(box(0.04, 0.4, 0.36, steel, [x, 0.2, 0]));
  }
  enableShadow(g);
  return g;
}
