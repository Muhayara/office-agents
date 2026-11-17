import * as THREE from 'three';
import { DOOR_HEIGHT, WALL_THICKNESS, type DoorSpan, type Pt } from '../layout';
import { box, std, stdLin } from './assets';

/**
 * Pintu dengan sensor gerak (Tahap 3). Daun pintu membuka bila ada agen dalam radius `sense`
 * dari tengah bukaan dan menutup lagi setelah jeda singkat. Pintu tidak pernah menghalangi
 * navigasi: agen berjalan ~2,2 m/s dan pintu sudah terbuka penuh sebelum agen sampai.
 *
 * Semua posisi LOKAL terhadap grup ruangan; `update` menerima posisi agen di DUNIA.
 */
export interface ProximityDoor {
  group: THREE.Group;
  /** 0 = tertutup, 1 = terbuka penuh. */
  readonly open: number;
  update: (dt: number, agents: readonly Pt[]) => void;
}

const OPEN_SPEED = 2.6;
const CLOSE_SPEED = 1.1;
const HOLD_S = 0.8;

function sensor(parent: THREE.Object3D, center: Pt, sense: number) {
  let worldCenter: THREE.Vector3 | null = null;
  let hold = 0;
  let open = 0;
  return {
    get open() { return open; },
    step(dt: number, agents: readonly Pt[]) {
      if (!worldCenter) {
        parent.updateWorldMatrix(true, false);
        worldCenter = parent.localToWorld(new THREE.Vector3(center.x, 0, center.z));
      }
      const near = agents.some((a) => Math.hypot(a.x - worldCenter!.x, a.z - worldCenter!.z) < sense);
      hold = near ? HOLD_S : Math.max(0, hold - dt);
      const target = near || hold > 0 ? 1 : 0;
      open = target > open ? Math.min(1, open + dt * OPEN_SPEED) : Math.max(0, open - dt * CLOSE_SPEED);
      return open;
    },
  };
}
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Pintu kaca geser ganda otomatis (Lobi): dua daun frameless bergeser ke samping di depan kaca
 * mati (sisi ruangan), dengan rel atas, rumah operator + lensa sensor, dan pegangan stainless panjang.
 * `wallZ` = pusat tebal dinding utara (lokal).
 */
export function slidingGlassDoor(o: { name: string; span: DoorSpan; wallZ: number; sense: number; parent: THREE.Object3D }): ProximityDoor {
  const g = new THREE.Group();
  g.name = o.name;
  const w = o.span.xMax - o.span.xMin;
  const cx = (o.span.xMin + o.span.xMax) / 2;
  const leafW = w / 2 + 0.02;
  const leafH = DOOR_HEIGHT - 0.03;
  const z = o.wallZ + WALL_THICKNESS / 2 + 0.035;          // di depan kaca mati, sisi dalam ruangan
  const glass = new THREE.MeshStandardMaterial({
    color: 0xcfe8ee, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide,
  });
  const steel = std(0xc9d0d6, 0.22, 0.95);
  const dark = stdLin([0.009, 0.023, 0.03], 0.35, 0.75);
  const makeLeaf = (sx: number) => {
    const leaf = new THREE.Group();
    leaf.name = `${o.name}_Leaf_${sx < 0 ? 'L' : 'R'}`;
    leaf.add(
      box(leafW, leafH - 0.06, 0.012, glass, [0, leafH / 2 + 0.01, 0], 'Leaf_Glass'),
      box(leafW, 0.05, 0.03, dark, [0, leafH - 0.015, 0], 'Leaf_Top_Patch'),
      box(leafW, 0.05, 0.03, dark, [0, 0.035, 0], 'Leaf_Bottom_Patch'),
      // Pegangan stainless panjang di sisi pertemuan, kedua muka
      box(0.025, 1.2, 0.025, steel, [-sx * (leafW / 2 - 0.09), 1.05, 0.04], 'Leaf_Pull_In'),
      box(0.025, 1.2, 0.025, steel, [-sx * (leafW / 2 - 0.09), 1.05, -0.04], 'Leaf_Pull_Out'),
    );
    leaf.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.castShadow = false; });
    g.add(leaf);
    return leaf;
  };
  const left = makeLeaf(-1);
  const right = makeLeaf(1);
  const head = box(w + 2 * leafW, 0.13, 0.11, dark, [cx, DOOR_HEIGHT + 0.065, z], 'Operator_Header');
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshStandardMaterial({ color: 0x0b0f12, roughness: 0.1, metalness: 0.2, emissive: 0x2a6a8a, emissiveIntensity: 0.6 }));
  lens.name = 'Motion_Sensor';
  lens.position.set(cx, DOOR_HEIGHT - 0.005, z + 0.04);
  g.add(head, lens);
  head.castShadow = false;
  const sense = sensor(o.parent, { x: cx, z: o.wallZ }, o.sense);
  const place = (k: number) => {
    const slide = (leafW - 0.04) * ease(k);
    left.position.set(cx - leafW / 2 + 0.02 - slide, 0, z);
    right.position.set(cx + leafW / 2 - 0.02 + slide, 0, z);
  };
  place(0);
  return {
    group: g,
    get open() { return sense.open; },
    update: (dt, agents) => place(sense.step(dt, agents)),
  };
}

/**
 * Pintu baja berengsel (Server / IT) dengan jendela intip kecil, berayun ke dalam ruangan,
 * plus keypad RFID di muka luar (LED merah = terkunci, hijau = terbuka).
 */
export function swingSteelDoor(o: { name: string; span: DoorSpan; wallZ: number; sense: number; parent: THREE.Object3D }): ProximityDoor {
  const g = new THREE.Group();
  g.name = o.name;
  const w = o.span.xMax - o.span.xMin - 0.02;
  const h = DOOR_HEIGHT - 0.03;
  const t = 0.045;
  const steel = std(0x6b747c, 0.42, 0.75);
  const steelDark = std(0x3c434a, 0.45, 0.7);
  const pivot = new THREE.Group();
  pivot.name = `${o.name}_Hinge`;
  // Engsel di kusen barat; daun duduk di muka dalam dinding.
  pivot.position.set(o.span.xMin + 0.01, 0, o.wallZ + WALL_THICKNESS / 2 - t / 2);
  g.add(pivot);
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb8c4, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  // Daun disusun bertingkat dengan lubang jendela intip 0,2 × 0,5 m (x vx0..vx1, y 1.30..1.80)
  const y0 = 0.01, vy0 = 1.3, vy1 = 1.8, vx0 = w / 2 + 0.05, vx1 = w / 2 + 0.25;
  pivot.add(
    box(w, vy0 - y0, t, steel, [w / 2, (y0 + vy0) / 2, 0], 'Leaf_Bottom'),
    box(w, h - vy1, t, steel, [w / 2, (vy1 + h) / 2, 0], 'Leaf_Top'),
    box(vx0, vy1 - vy0, t, steel, [vx0 / 2, (vy0 + vy1) / 2, 0], 'Leaf_Band_W'),
    box(w - vx1, vy1 - vy0, t, steel, [(vx1 + w) / 2, (vy0 + vy1) / 2, 0], 'Leaf_Band_E'),
    box(vx1 - vx0, vy1 - vy0, 0.012, glass, [(vx0 + vx1) / 2, (vy0 + vy1) / 2, 0], 'Vision_Panel'),
    box(w - 0.04, 0.22, 0.004, steelDark, [w / 2, 0.13, t / 2 + 0.002], 'Kick_Plate'),
    box(0.13, 0.03, 0.03, std(0xd0d6db, 0.25, 0.9), [w - 0.12, 1.02, t / 2 + 0.02], 'Lever_In'),
    box(0.13, 0.03, 0.03, std(0xd0d6db, 0.25, 0.9), [w - 0.12, 1.02, -t / 2 - 0.02], 'Lever_Out'),
  );
  // Bingkai jendela intip (kedua muka)
  const frame = std(0x2a2f34, 0.4, 0.6);
  const fw = vx1 - vx0 + 0.04, fx = (vx0 + vx1) / 2, fy = (vy0 + vy1) / 2;
  pivot.add(
    box(fw, 0.02, t + 0.008, frame, [fx, vy1 + 0.01, 0], 'Vision_Frame_T'),
    box(fw, 0.02, t + 0.008, frame, [fx, vy0 - 0.01, 0], 'Vision_Frame_B'),
    box(0.02, vy1 - vy0, t + 0.008, frame, [vx0 - 0.01, fy, 0], 'Vision_Frame_W'),
    box(0.02, vy1 - vy0, t + 0.008, frame, [vx1 + 0.01, fy, 0], 'Vision_Frame_E'),
  );
  pivot.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.castShadow = false; });

  // Keypad RFID di muka luar (sisi Jalan Utama), di kanan pintu
  const pad = new THREE.Group();
  pad.name = `${o.name}_RFID_Keypad`;
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xef4444, emissiveIntensity: 1.6, roughness: 0.3 });
  pad.add(
    box(0.09, 0.14, 0.025, std(0x14171a, 0.4, 0.5), [0, 0, 0], 'Keypad_Body'),
    box(0.06, 0.05, 0.004, std(0x1f2937, 0.2, 0.3, { emissive: 0x1e3a5f, emissiveIntensity: 0.5 }), [0, 0.035, -0.014], 'Keypad_Reader'),
  );
  const led = box(0.012, 0.012, 0.006, ledMat, [0.03, -0.045, -0.014], 'Keypad_LED');
  pad.add(led);
  pad.position.set(o.span.xMax + 0.2, 1.25, o.wallZ - WALL_THICKNESS / 2 - 0.013);
  g.add(pad);

  const sense = sensor(o.parent, { x: (o.span.xMin + o.span.xMax) / 2, z: o.wallZ }, o.sense);
  let lastGreen = false;
  return {
    group: g,
    get open() { return sense.open; },
    update: (dt, agents) => {
      const k = sense.step(dt, agents);
      pivot.rotation.y = -THREE.MathUtils.degToRad(100) * ease(k);
      const green = k > 0.02;
      if (green !== lastGreen) {
        lastGreen = green;
        // Baca material dari mesh: WallFader mengklon material dinding saat registrasi.
        (led.material as THREE.MeshStandardMaterial).emissive.setHex(green ? 0x22c55e : 0xef4444);
      }
    },
  };
}
