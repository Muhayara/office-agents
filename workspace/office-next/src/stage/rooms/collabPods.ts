import * as THREE from 'three';
import { COLLABPODS, ROOM_COLLABPODS, type Spot } from '../layout';
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
import { buildNorthTierShell } from './northWing';

/**
 * LAYER RUANGAN TAHAP 5: Room_CollabPods, pusat dunia (28.5, -3.0), 5 × 4 m, sudut timur laut gedung.
 *
 * 2 diner pod 2 orang untuk pair-programming / design critique, diakses lewat pintu utara Workshop.
 * - Utara : dinding luar gedung (solid dari kamera Tenggara).
 * - Timur : dinding luar timur gedung (memudar dari kamera Tenggara).
 * - Barat : dinding timur Information Wall; Selatan: dinding utara Workshop (keduanya milik tetangga).
 * Pod terbuka ke +Z (Selatan, ke kamera); lampu okupansi di atas punggung pod milik scene
 * (hijau = kosong, amber = terpakai).
 */
export interface CollabPods {
  group: THREE.Group;
  bindWalls: () => void;
  /** 4 kursi (dunia): [pod A kiri, pod A kanan, pod B kiri, pod B kanan]. */
  seatsWorld: () => Array<{ spot: Spot; approach: Spot }>;
  setOccupancy: (busy: readonly boolean[]) => void;
  focusPoint: () => THREE.Vector3;
}

export function buildCollabPods(load: ModelLoader, fader: WallFader): CollabPods {
  const shell = buildNorthTierShell({ spec: ROOM_COLLABPODS, fader, fadeId: 'collabpods', interiorSides: [], sides: { west: false } });
  const { group, sub, inner } = shell;
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

  // ---- Karpet akustik hijau-abu + karpet aksen di bawah tiap pod ----
  {
    const W = inner.maxX - inner.minX, D = inner.maxZ - inner.minZ;
    floor.add(meterBox(W, 0.02, D, sageCarpet(), [(inner.minX + inner.maxX) / 2, -0.01, (inner.minZ + inner.maxZ) / 2], 'Pods_Acoustic_Carpet'));
    const accent = std(0x3f5a52, 0.95, 0);
    COLLABPODS.pods.forEach((p, i) => {
      const rug = meterBox(COLLABPODS.pod.w + 0.1, 0.012, COLLABPODS.pod.d + 0.3, accent, [p.x, 0.001, p.z + 0.12], `Pod_Accent_Rug_${i}`);
      floor.add(rug);
    });
  }

  // ---- 2 diner pod + lampu okupansi (overlay scene, tetap ada saat GLB dimuat) ----
  const lamps: THREE.MeshStandardMaterial[][] = [];
  let lastBusy: readonly boolean[] = [false, false];
  const setOccupancy = (busy: readonly boolean[]) => {
    lastBusy = busy;
    lamps.forEach((mats, i) => mats.forEach((m) => {
      const b = !!busy[i];
      if (m.emissive) m.emissive.setHex(b ? 0xf59e0b : 0x34d399);
      m.color.setHex(b ? 0x3a2405 : 0x0b2a14);
    }));
  };
  COLLABPODS.pods.forEach((p, i) => {
    const s = slot(furniture, `Diner_Pod_${i ? 'B' : 'A'}`, p.x, 0, p.z);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x0b2a14, emissive: 0x34d399, emissiveIntensity: 1.4, roughness: 0.4 });
    lampMat.name = `Pod_Occupancy_Lamp_${i}`;
    const lamp = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.22, 4, 12), lampMat);
    lamp.name = `Occupancy_Lamp_${i}`;
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(0, COLLABPODS.pod.h + 0.035, -COLLABPODS.pod.d / 2 + 0.05);
    lamp.castShadow = false;
    s.add(lamp);
    lamps.push([lampMat]);
    // GLB dengan mesh `Pod_Occupancy_LED` (tahap-5-3d-prompts.md): LED GLB yang diwarnai, kapsul scene disembunyikan.
    mountAsset(s, '/models/Office_Collab_Diner_Pod.glb', dinerPodPlaceholder(), load, (model) => {
      const led = model.getObjectByName('Pod_Occupancy_LED') as THREE.Mesh | undefined;
      if (!led?.isMesh || Array.isArray(led.material)) return;
      const m = (led.material as THREE.MeshStandardMaterial).clone();
      led.material = m;
      lamp.visible = false;
      lamps[i] = [m];
      setOccupancy(lastBusy);
    });
  });

  // ---- Snake plant di celah antar-pod + cahaya ----
  {
    mountAsset(slot(decor, 'Pods_SnakePlant', COLLABPODS.snakePlant.x, 0, COLLABPODS.snakePlant.z), '/models/Office_Indoor_Plant_SnakePlant.glb', new THREE.Group(), load);
    const l = lightAnchor(0xfff1e0, 7, 5.5, 1.6);
    l.name = 'Pods_Light';
    l.position.set(COLLABPODS.light.x, COLLABPODS.light.y, COLLABPODS.light.z);
    decor.add(l);
  }

  const toWorldSpot = (x: number, z: number, rotY = 0): Spot => {
    const v = shell.local(x, 0, z);
    return { x: v.x, z: v.z, rotY };
  };
  const o = COLLABPODS.seatOffsetX;
  return {
    group,
    bindWalls: shell.bindWalls,
    seatsWorld: () => COLLABPODS.pods.flatMap((p) => [
      { spot: toWorldSpot(p.x - o, p.z, Math.PI / 2), approach: toWorldSpot(p.x - o, COLLABPODS.approachZ, Math.PI / 2) },
      { spot: toWorldSpot(p.x + o, p.z, -Math.PI / 2), approach: toWorldSpot(p.x + o, COLLABPODS.approachZ, -Math.PI / 2) },
    ]),
    setOccupancy,
    focusPoint: () => shell.local(0, 1.0, -0.3),
  };
}

function rnd(seed: number) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

/** Karpet akustik hijau-abu lembut, canvas = 1 m. */
function sageCarpet() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!, img = x.createImageData(S, S), d = img.data, r = rnd(63);
  for (let i = 0; i < S * S; i++) { const v = 0.9 + r() * 0.1; d[i * 4] = 104 * v; d[i * 4 + 1] = 120 * v; d[i * 4 + 2] = 112 * v; d[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.96, 0, { map: tex });
}

/**
 * Diner pod 2 orang, kontrak GLB `Office_Collab_Diner_Pod`: W 1,90 (X) × H 1,32 × D 1,30 (Z), origin lantai
 * tengah. Dinding punggung akustik + layar mini 27" di −Z, sisi masuk terbuka penuh di +Z. 2 bangku sofa
 * berhadapan di x ±0,71 (dudukan 0,45, sandaran tinggi di sisi luar), meja tengah 0,52 × 1,10 setinggi 0,72.
 * Lampu okupansi: mesh `Pod_Occupancy_LED` di GLB (diwarnai scene) atau, bila tidak ada, kapsul milik scene
 * di atas punggung (y ±1,36).
 */
function dinerPodPlaceholder() {
  const P = COLLABPODS.pod, g = new THREE.Group();
  g.name = 'Diner_Pod_Placeholder';
  const shellMat = std(0x2f4a44, 0.9, 0);
  const seat = std(0x7c9a8e, 0.88, 0);
  const oak = std(0xb88a5a, 0.5, 0.03);
  g.add(box(P.w, P.h, 0.08, shellMat, [0, P.h / 2, -P.d / 2 + 0.04], 'Back_Acoustic_Wall'));
  g.add(box(0.6, 0.35, 0.02, std(0x0b1d2a, 0.2, 0.4, { emissive: 0x16405c, emissiveIntensity: 0.7 }), [0, 1.0, -P.d / 2 + 0.09], 'Mini_Screen_27'));
  [-1, 1].forEach((s) => {
    const x = s * P.benchX;
    g.add(box(0.48, 0.4, P.d - 0.1, shellMat, [x, 0.2, 0.05 - 0.05], 'Bench_Base'));
    g.add(box(0.46, 0.05, P.d - 0.14, seat, [x, P.seatH - 0.025, 0], 'Bench_Cushion'));
    g.add(box(0.12, 1.1, P.d - 0.1, shellMat, [s * (P.w / 2 - 0.06), 0.55, 0], 'Side_High_Back'));
    g.add(box(0.06, 0.5, P.d - 0.16, seat, [s * (P.w / 2 - 0.15), P.seatH + 0.25, 0], 'Back_Cushion'));
  });
  g.add(box(P.tableW, 0.03, P.tableD, oak, [0, P.tableH - 0.015, 0], 'Center_Table_Top'));
  g.add(box(0.06, P.tableH - 0.03, 0.06, std(0x17191c, 0.5, 0.7), [0, (P.tableH - 0.03) / 2, 0], 'Center_Table_Post'));
  g.add(box(0.36, 0.015, 0.5, std(0x17191c, 0.5, 0.7), [0, 0.0075, 0], 'Center_Table_Foot'));
  enableShadow(g);
  return g;
}
