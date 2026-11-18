import * as THREE from 'three';
import { FOCUSPODS, ROOM_FOCUS, type Pt, type Spot } from '../layout';
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
import { smokedGlassWallMats } from './walls';

/**
 * LAYER RUANGAN TAHAP 6: Room_FocusPods, pusat dunia (16.0, 10.4), 4 × 6 m, sisi selatan bus.
 *
 * Ruang hening berisi 2 bilik fokus tunggal (open-top) untuk deep work; lampu status pod hijau = kosong,
 * merah koral = Deep Focus.
 * - Utara : kaca berasap + privacy band akustik, pintu kaca geser otomatis 1,4 m (selalu memudar).
 * - Barat / Timur: dinding timur Lounge & dinding barat Server (milik tetangga, keduanya selalu memudar).
 * - Selatan: dinding luar gedung (memudar dari kamera Tenggara).
 * Bilik di sisi barat diputar 45°: mulut terbuka ke Tenggara, searah kamera isometrik (agen & layar 34" terlihat).
 */
export interface FocusPods {
  group: THREE.Group;
  bindWalls: () => void;
  /** Kursi bilik (dunia): titik duduk + titik berdiri di depan mulut bilik. */
  seatsWorld: () => Array<{ spot: Spot; approach: Spot }>;
  /** Lampu status per bilik: true = Deep Focus (merah koral). */
  setBusy: (busy: readonly boolean[]) => void;
  /**
   * Tempel papan "QUIET ZONE" ke dinding barat ruangan (= dinding timur Lounge) agar ikut memudar bersamanya.
   * Panggil setelah gedung di-updateMatrixWorld dan SEBELUM dinding Lounge didaftarkan ke Auto-Fade.
   */
  attachSign: (westWall: THREE.Object3D | undefined) => void;
  update: (dt: number, agents: readonly Pt[]) => void;
  focusPoint: () => THREE.Vector3;
}

const FREE = 0x34d399;
const BUSY = 0xf43f5e;

export function buildFocusPods(load: ModelLoader, fader: WallFader): FocusPods {
  const shell = buildSouthRoomShell({
    spec: ROOM_FOCUS,
    fader,
    fadeId: 'focus',
    glass: smokedGlassWallMats(),
    glassBand: { yMin: 0.95, yMax: 1.75 },
    interiorSides: [],
    sides: { west: false, east: false },
  });
  const { group, sub, inner } = shell;
  const floor = sub('SubLayer_Floor');
  const furniture = sub('SubLayer_Furniture');
  const decor = sub('SubLayer_Decor');
  const slot = (parent: THREE.Object3D, name: string, x: number, y: number, z: number, rotY = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  };

  // ---- Karpet akustik wol slate-navy + strip walnut penanda zona hening ----
  {
    const W = inner.maxX - inner.minX, D = inner.maxZ - inner.minZ;
    floor.add(meterBox(W, 0.02, D, navyCarpet(), [(inner.minX + inner.maxX) / 2, -0.01, (inner.minZ + inner.maxZ) / 2], 'Focus_Acoustic_Carpet'));
    const walnut = std(0x5a3d29, 0.55, 0.03);
    // Strip di batas zona hening (antara lorong timur & mulut bilik) dan di depan pintu.
    floor.add(meterBox(0.06, 0.02, 4.4, walnut, [0.3, -0.005, 0.2], 'Quiet_Zone_Strip'));
    floor.add(meterBox(1.6, 0.02, 0.06, walnut, [0, -0.005, inner.minZ + 0.7], 'Entry_Strip'));
  }

  // ---- 2 bilik fokus tunggal + lampu status (kapsul scene; diganti LED GLB bila ada) ----
  const lamps: THREE.MeshStandardMaterial[][] = [];
  let lastBusy: readonly boolean[] = [false, false];
  const setBusy = (busy: readonly boolean[]) => {
    lastBusy = busy;
    lamps.forEach((mats, i) => mats.forEach((m) => {
      const b = !!busy[i];
      if (m.emissive) m.emissive.setHex(b ? BUSY : FREE);
      m.color.setHex(b ? 0x3a0a14 : 0x0b2a14);
    }));
  };
  const P = FOCUSPODS.pod;
  FOCUSPODS.pods.forEach((p, i) => {
    const s = slot(furniture, `Focus_Pod_${i}`, p.x, 0, p.z, P.rotY);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x0b2a14, emissive: FREE, emissiveIntensity: 1.4, roughness: 0.35 });
    lampMat.name = `Focus_Status_Lamp_${i}`;
    const lamp = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.3, 4, 12), lampMat);
    lamp.name = `Focus_Status_Lamp_${i}`;
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(0, P.h + 0.035, -P.d / 2 + 0.05);
    lamp.castShadow = false;
    s.add(lamp);
    lamps.push([lampMat]);
    // GLB dengan mesh `Focus_Status_LED` (tahap-6-3d-prompts.md): LED GLB yang diwarnai, kapsul disembunyikan.
    mountAsset(s, '/models/Office_Focus_Solo_Pod.glb', soloPodPlaceholder(i), load, (model) => {
      const led = model.getObjectByName('Focus_Status_LED') as THREE.Mesh | undefined;
      if (!led?.isMesh || Array.isArray(led.material)) return;
      const m = (led.material as THREE.MeshStandardMaterial).clone();
      led.material = m;
      lamp.visible = false;
      lamps[i] = [m];
      setBusy(lastBusy);
    });
  });

  // ---- Tanaman + cahaya tenang ----
  {
    FOCUSPODS.plants.forEach((p, i) => {
      mountAsset(slot(decor, `Focus_SnakePlant_${i}`, p.x, 0, p.z), '/models/Office_Indoor_Plant_SnakePlant.glb', new THREE.Group(), load);
    });
    const l = new THREE.PointLight(0xfff0dc, 6, 5.5, 1.6);
    l.name = 'Focus_Light';
    l.position.set(FOCUSPODS.light.x, FOCUSPODS.light.y, FOCUSPODS.light.z);
    decor.add(l);
  }

  // ---- Papan "QUIET ZONE · DEEP FOCUS" (ditempel ke dinding barat lewat attachSign) ----
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.3),
    new THREE.MeshBasicMaterial({ map: quietSignTexture(), transparent: true, toneMapped: false, depthWrite: false }),
  );
  sign.name = 'Quiet_Zone_Sign';
  sign.userData.fadeHide = true;   // dinding timur Lounge selalu memudar: papan hanya tampil di mode jalan kaki
  sign.position.set(FOCUSPODS.sign.x + 0.006, FOCUSPODS.sign.y, FOCUSPODS.sign.z);
  sign.rotation.y = Math.PI / 2;
  decor.add(sign);

  // ---- Pintu kaca geser otomatis ----
  const door = slidingGlassDoor({ name: 'Focus_Sliding_Door', span: ROOM_FOCUS.northDoor, wallZ: -ROOM_FOCUS.halfZ + 0.12, sense: FOCUSPODS.doorSense, parent: group });

  const toWorldSpot = (x: number, z: number, rotY = 0): Spot => {
    const v = shell.local(x, 0, z);
    return { x: v.x, z: v.z, rotY };
  };
  return {
    group,
    bindWalls: shell.bindWalls,
    seatsWorld: () => {
      // +Z lokal bilik di koordinat ruangan; agen menghadap meja (−Z lokal).
      const r = FOCUSPODS.pod.rotY, dx = Math.sin(r), dz = Math.cos(r), face = r + Math.PI;
      return FOCUSPODS.pods.map((p) => ({
        spot: toWorldSpot(p.x + dx * FOCUSPODS.seatDZ, p.z + dz * FOCUSPODS.seatDZ, face),
        approach: toWorldSpot(p.x + dx * FOCUSPODS.approachDZ, p.z + dz * FOCUSPODS.approachDZ, face),
      }));
    },
    setBusy,
    attachSign: (westWall) => {
      if (!westWall) return;
      group.updateMatrixWorld(true);
      westWall.attach(sign);
    },
    update: (dt, agents) => door.update(dt, agents),
    focusPoint: () => shell.local(-0.3, 0.9, 0.3),
  };
}

function rnd(seed: number) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

/** Karpet wol akustik slate-navy, canvas = 1 m. */
function navyCarpet() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!, img = x.createImageData(S, S), d = img.data, r = rnd(71);
  for (let i = 0; i < S * S; i++) { const v = 0.9 + r() * 0.1; d[i * 4] = 46 * v; d[i * 4 + 1] = 58 * v; d[i * 4 + 2] = 78 * v; d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.97, 0, { map: tex });
}

function quietSignTexture() {
  const c = document.createElement('canvas'); c.width = 1000; c.height = 200;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 1000, 200);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#e8edf2'; x.font = '800 86px "Inter", "Segoe UI", system-ui, sans-serif';
  x.fillText('QUIET ZONE', 500, 80);
  x.fillStyle = '#93c5fd'; x.font = '500 36px "Inter", "Segoe UI", system-ui, sans-serif';
  x.fillText('deep focus · mohon hening', 500, 158);
  return canvasTexture(c);
}

/** Layar IDE mode gelap untuk monitor 34". */
function ideTexture(seed: number) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 224;
  const x = c.getContext('2d')!, r = rnd(seed);
  x.fillStyle = '#0d1117'; x.fillRect(0, 0, 512, 224);
  x.fillStyle = '#161b22'; x.fillRect(0, 0, 90, 224);
  const cols = ['#ff7b72', '#79c0ff', '#d2a8ff', '#a5d6ff', '#7ee787', '#c9d1d9'];
  for (let row = 0; row < 15; row++) {
    let px = 104 + (row % 4) * 14;
    for (let k = 0; k < 4; k++) { const w = 16 + r() * 60; x.fillStyle = cols[Math.floor(r() * cols.length)]!; x.fillRect(px, 10 + row * 14, w, 6); px += w + 8; if (px > 500) break; }
  }
  x.fillStyle = '#7ee787'; x.fillRect(96, 200, 300, 6);
  return canvasTexture(c);
}

/**
 * Bilik fokus tunggal, kontrak GLB `Office_Focus_Solo_Pod`: W 1,36 (X) × H 1,48 × D 1,16 (Z), origin lantai
 * tengah, TANPA atap. Meja walnut z −0,50..−0,06 setinggi 0,73 + monitor 34" di −Z; dudukan 0,45 di (0, +0,18)
 * menghadap −Z; mulut bilik 0,74 m terbuka di +Z tanpa ambang. Panel samping berjendela kaca akustik.
 */
function soloPodPlaceholder(i: number) {
  const P = FOCUSPODS.pod, g = new THREE.Group();
  g.name = 'Solo_Pod_Placeholder';
  const shellMat = std(0x34404a, 0.9, 0);
  const felt = std(0x4b5d6b, 0.95, 0);
  const walnut = std(0x5a3d29, 0.5, 0.04);
  const glass = new THREE.MeshStandardMaterial({ color: 0xcfe8ee, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
  const hw = P.w / 2, hd = P.d / 2, T = 0.06;
  g.add(box(P.w, P.h, T, shellMat, [0, P.h / 2, -hd + T / 2], 'Back_Acoustic_Panel'));
  g.add(box(P.w - 0.14, 0.9, 0.02, felt, [0, 1.0, -hd + T + 0.01], 'Back_Felt'));
  [-1, 1].forEach((sx) => {
    const x = sx * (hw - T / 2);
    g.add(box(T, 0.82, P.d - T, shellMat, [x, 0.41, T / 2], 'Side_Panel_Low'));
    g.add(box(T, 0.1, P.d - T, shellMat, [x, P.h - 0.05, T / 2], 'Side_Panel_Rail'));
    g.add(box(T, P.h, 0.08, shellMat, [x, P.h / 2, -hd + T + 0.04], 'Side_Post_Back'));
    g.add(box(T, P.h, 0.08, shellMat, [x, P.h / 2, hd - 0.04], 'Side_Post_Front'));
    const win = box(0.012, P.h - 0.92, P.d - T - 0.16, glass, [x, (0.82 + P.h - 0.1) / 2, T / 2], 'Acoustic_Window');
    win.castShadow = false;
    g.add(win);
    // Sirip depan: mulut bilik 0,74 m (x ±0,37).
    g.add(box(hw - 0.37 - T, P.h, 0.05, shellMat, [sx * (0.37 + (hw - 0.37 - T) / 2), P.h / 2, hd - 0.025], 'Front_Return'));
  });
  g.add(box(P.w - 2 * T, 0.04, 0.44, walnut, [0, 0.71, -0.28], 'Focus_Desk'));
  g.add(box(0.05, 0.69, 0.05, std(0x17191c, 0.5, 0.7), [0, 0.345, -0.4], 'Desk_Post'));
  const scr = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: ideTexture(11 + i * 7), emissiveIntensity: 0.9, roughness: 0.3 });
  g.add(box(0.8, 0.36, 0.03, std(0x111317, 0.4, 0.5), [0, 1.02, -0.42], 'Monitor_34'));
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.32), scr);
  s.name = 'Monitor_34_Screen';
  s.position.set(0, 1.02, -0.404);
  g.add(s, box(0.04, 0.26, 0.04, std(0x111317, 0.4, 0.5), [0, 0.86, -0.44], 'Monitor_Stand'));
  g.add(box(0.36, 0.015, 0.12, std(0x22262c, 0.6, 0.2), [0, 0.738, -0.16], 'Keyboard'));
  g.add(box(0.03, 0.34, 0.03, std(0x1a1a1a, 0.4, 0.6), [-0.42, 0.9, -0.42], 'Task_Lamp_Arm'));
  g.add(box(0.12, 0.03, 0.08, std(0xfff2d6, 0.4, 0, { emissive: 0xffd9a0, emissiveIntensity: 0.9 }), [-0.38, 1.07, -0.36], 'Task_Lamp_Head'));
  // Dudukan terintegrasi: bantalan 0,45 di (0, +0,18), sandaran rendah z 0,36..0,44.
  const seatMat = std(0x6b7f91, 0.9, 0);
  g.add(box(0.6, 0.08, 0.34, seatMat, [0, 0.41, 0.19], 'Seat_Cushion'));
  g.add(box(0.56, 0.37, 0.08, seatMat, [0, 0.635, 0.4], 'Seat_Backrest'));
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.37, 14), std(0x17191c, 0.5, 0.7));
  ped.position.set(0, 0.185, 0.19);
  g.add(ped);
  enableShadow(g);
  return g;
}
