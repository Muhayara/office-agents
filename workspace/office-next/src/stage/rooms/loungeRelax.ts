import * as THREE from 'three';
import { LOUNGE, ROOM_LOUNGE, WALL_HEIGHT, type Spot } from '../layout';
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
import { buildSouthRoomShell } from './southWing';
import { glassWallMats } from './walls';

/**
 * LAYER RUANGAN TAHAP 3: Room_LoungeRelax, pusat dunia (11.5, 10.4), 5 × 6 m.
 *
 * Ruang santai di seberang Meeting Foyer: peserta rapat mampir ke sini setelah rapat bubar.
 * - Utara : kaca bening penuh + bukaan 1,4 m ke Jalan Utama.
 * - Barat : dinding timur Pantry (tidak dibangun ulang); muka sisi Lounge dicat sage + lukisan
 *           kanvas & rak tipis, menghadap Timur (terlihat dari kamera).
 * - Timur : dinding dalam ke calon Focus Pods (Tahap 6).
 * - Selatan: dinding luar dicat sage (memudar di kamera isometrik).
 */
export interface LoungeRelax {
  group: THREE.Group;
  bindWalls: () => void;
  /** Kursi sofa (dunia): titik duduk + titik berdiri sebelum duduk. */
  seatsWorld: () => Array<{ spot: Spot; approach: Spot }>;
  focusPoint: () => THREE.Vector3;
}

export function buildLoungeRelax(load: ModelLoader, fader: WallFader): LoungeRelax {
  const shell = buildSouthRoomShell({
    spec: ROOM_LOUNGE,
    fader,
    fadeId: 'lounge',
    glass: glassWallMats(),
    interiorSides: ['east'],
    sides: { west: false },
  });
  const { group, sub, inner, walls } = shell;
  const floor = sub('SubLayer_Floor');
  const furniture = sub('SubLayer_Furniture');
  const decor = sub('SubLayer_Decor');
  const westFace = sub('SubLayer_WestFace_Sage');

  const slot = (parent: THREE.Group, name: string, x: number, y: number, z: number, rotY = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  };

  // ---- Lantai karpet plush abu-abu hangat ----
  {
    const W = inner.maxX - inner.minX, D = inner.maxZ - inner.minZ;
    floor.add(meterBox(W, 0.02, D, plushCarpetMaterial(), [(inner.minX + inner.maxX) / 2, -0.01, 0], 'Lounge_Plush_Carpet'));
  }

  // ---- Cat sage bertekstur: muka dinding barat (milik Pantry) & muka dalam dinding selatan ----
  const sage = sagePaintMaterial();
  {
    const paint = meterBox(0.012, WALL_HEIGHT - 0.14, inner.maxZ - inner.minZ, sage, [inner.minX + 0.006, 0.14 + (WALL_HEIGHT - 0.14) / 2, 0], 'West_Face_Sage');
    paint.castShadow = false;
    westFace.add(paint);
    const south = meterBox(inner.maxX - inner.minX, WALL_HEIGHT - 0.14, 0.012, sage, [(inner.minX + inner.maxX) / 2, 0.14 + (WALL_HEIGHT - 0.14) / 2, inner.maxZ - 0.006], 'South_Face_Sage');
    walls.south.add(south);
  }

  // ---- Lukisan kanvas kontemporer + rak buku tipis di muka barat (tetap solid) ----
  {
    const a = LOUNGE.art;
    // UV kotak biasa (0..1 per muka): lukisan tampil utuh sekali di muka +X, tidak terulang per meter.
    const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.035, a.h, a.w), std(0xffffff, 0.85, 0, { map: artTexture() }));
    canvas.name = 'Canvas_Art';
    canvas.position.set(a.x + 0.0175, a.y, a.z);
    const frameMat = std(0x2d2016, 0.5, 0.05);
    const fr = (w: number, h: number, d: number, y: number, z: number, n: string) => decor.add(box(w, h, d, frameMat, [a.x + 0.02, y, z], n));
    fr(0.045, 0.025, a.w + 0.05, a.y + a.h / 2 + 0.0125, a.z, 'Art_Frame_T');
    fr(0.045, 0.025, a.w + 0.05, a.y - a.h / 2 - 0.0125, a.z, 'Art_Frame_B');
    fr(0.045, a.h, 0.025, a.y, a.z - a.w / 2 - 0.0125, 'Art_Frame_N');
    fr(0.045, a.h, 0.025, a.y, a.z + a.w / 2 + 0.0125, 'Art_Frame_S');
    canvas.castShadow = false;
    decor.add(canvas);
    const s = LOUNGE.shelf;
    const oak = std(0xb88a5a, 0.55, 0.05);
    decor.add(box(0.2, 0.03, s.len, oak, [s.x, s.y, s.z], 'Slim_Shelf_Lower'));
    decor.add(box(0.2, 0.03, s.len, oak, [s.x, s.y + 0.42, s.z], 'Slim_Shelf_Upper'));
    const bookColors = [0x1f4d55, 0xc9973a, 0xe8e2d4, 0x7a3b2e, 0x3b5b7a, 0x2f3236];
    for (let row = 0; row < 2; row++) {
      let z = s.z - s.len / 2 + 0.06;
      for (let k = 0; k < 9 && z < s.z + s.len / 2 - 0.08; k++) {
        const h = 0.2 + ((k * 7 + row * 3) % 5) * 0.025, t = 0.03 + ((k + row) % 3) * 0.008;
        const b = box(0.15, h, t, std(bookColors[(k + row * 2) % bookColors.length]!, 0.7, 0), [s.x + 0.01, s.y + 0.015 + row * 0.42 + h / 2, z + t / 2], 'Book');
        if (k === 4 && row === 0) { b.rotation.x = 0.25; }
        decor.add(b);
        z += t + 0.006;
      }
    }
  }

  // ---- Sofa sectional L di pojok barat daya; origin GLB = sudut belakang-kiri, diputar +90° ----
  {
    const s = LOUNGE.sofa;
    mountAsset(slot(furniture, 'Sectional_L_Sofa', s.originX, 0, s.originZ, s.rotY), '/models/Office_Lounge_Sectional_Sofa.glb', sectionalSofaPlaceholder(), load);
  }

  // ---- Meja kopi rendah walnut + kaki besi silang ----
  {
    const t = LOUNGE.coffeeTable;
    mountAsset(slot(furniture, 'Coffee_Table_Walnut', t.x, 0, t.z, t.rotY), '/models/Office_Lounge_Coffee_Table.glb', coffeeTablePlaceholder(t.w, t.d, t.h), load);
  }

  // ---- Lampu lantai melengkung (kubah kuningan) + cahaya hangat ----
  {
    const l = LOUNGE.arcLamp;
    // GLB: kap di +Z lokal sejauh `reach`; yaw agar kap menggantung di atas titik `aim` (meja kopi).
    const yaw = Math.atan2(l.aimX - l.baseX, l.aimZ - l.baseZ);
    mountAsset(slot(furniture, 'Arc_Floor_Lamp', l.baseX, 0, l.baseZ, yaw), '/models/Office_Lounge_Arc_Floor_Lamp.glb', arcLampPlaceholder(0, l.rimY, l.reach), load);
    const light = new THREE.PointLight(0xffcf9a, 12, 5.5, 1.7);
    light.name = 'Arc_Lamp_Warm_Light';
    light.position.set(l.baseX + Math.sin(yaw) * l.reach, l.rimY - 0.1, l.baseZ + Math.cos(yaw) * l.reach);
    decor.add(light);
  }

  // ---- Areca palm (pot terakota) + rak majalah stainless ----
  {
    const p = LOUNGE.palm;
    mountAsset(slot(decor, 'Areca_Palm', p.x, 0, p.z), '/models/Office_Plant_Areca_Palm.glb', arecaPalmPlaceholder(), load);
    const m = LOUNGE.magazineRack;
    mountAsset(slot(decor, 'Magazine_Rack', m.x, 0, m.z, Math.PI / 2), '/models/Office_Lounge_Magazine_Rack.glb', magazineRackPlaceholder(), load);
  }

  const toWorldSpot = (p: { x: number; z: number }, rotY = 0): Spot => {
    const v = shell.local(p.x, 0, p.z);
    return { x: v.x, z: v.z, rotY };
  };

  return {
    group,
    bindWalls: () => {
      shell.bindWalls();
      // Cat sage di muka dinding milik Pantry ikut memudar bersama dinding itu (dinding dalam).
      group.updateWorldMatrix(true, true);
      fader.register('lounge_west_face', [westFace], new THREE.Vector3(1, 0, 0), shell.local(inner.minX, 0, 0), { interior: true });
    },
    seatsWorld: () => LOUNGE.seats.map((s) => ({ spot: toWorldSpot(s.spot, s.spot.rotY), approach: toWorldSpot(s.approach, s.spot.rotY) })),
    focusPoint: () => shell.local(-0.6, 1.05, 0.6),
  };
}

// ============================================================================
// Tekstur prosedural
// ============================================================================
function rnd(seed: number) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

/** Karpet plush abu-abu hangat: serat halus acak, canvas = 1 m. */
function plushCarpetMaterial() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!, img = x.createImageData(S, S), d = img.data, r = rnd(9);
  for (let i = 0; i < S * S; i++) {
    const v = 0.9 + r() * 0.12;
    d[i * 4] = 128 * v; d[i * 4 + 1] = 120 * v; d[i * 4 + 2] = 112 * v; d[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.98, 0, { map: tex });
}

/** Cat sage green bertekstur (efek kuas/roll halus), canvas = 1 m. */
function sagePaintMaterial() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#7f927b'; x.fillRect(0, 0, S, S);
  const r = rnd(21);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.04)';
    x.fillRect(r() * S, r() * S, 2 + r() * 10, 1 + r() * 3);
  }
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.92, 0, { map: tex });
}

/** Lukisan abstrak kontemporer (blok warna hangat + garis), 1,5 × 0,95 m. */
function artTexture() {
  const c = document.createElement('canvas'); c.width = 600; c.height = 380;
  const x = c.getContext('2d')!;
  x.fillStyle = '#efe7da'; x.fillRect(0, 0, 600, 380);
  const blocks: Array<[number, number, number, number, string]> = [
    [40, 50, 220, 260, '#1f4d55'], [230, 120, 180, 210, '#c9973a'], [380, 40, 170, 160, '#b5523b'], [420, 220, 140, 120, '#2f3236'],
  ];
  blocks.forEach(([bx, by, w, h, col]) => { x.globalAlpha = 0.92; x.fillStyle = col; x.fillRect(bx, by, w, h); });
  x.globalAlpha = 1;
  x.strokeStyle = '#2f3236'; x.lineWidth = 4;
  x.beginPath(); x.arc(330, 200, 110, Math.PI * 0.9, Math.PI * 1.9); x.stroke();
  x.fillStyle = '#efe7da'; x.beginPath(); x.arc(150, 170, 42, 0, Math.PI * 2); x.fill();
  return canvasTexture(c);
}

// ============================================================================
// Placeholder prosedural (otomatis diganti GLB bila file-nya ada di public/models)
// ============================================================================
/**
 * Sofa sectional L, kontrak GLB `Office_Lounge_Sectional_Sofa`: origin = sudut belakang-kiri di lantai,
 * X 0..2.60 × Z 0..1.80, hadap +Z. Bagian utama Z 0..0.90 (3 bantal dudukan), chaise X 0..0.913 ×
 * Z 0.90..1.80 di sisi -X. Linen abu hangat, plinth oak, bantal aksen mustard & teal. Dudukan 0,44 m.
 */
function sectionalSofaPlaceholder() {
  const s = LOUNGE.sofa;
  const g = new THREE.Group();
  g.name = 'Sectional_Sofa_Placeholder';
  const fabric = std(0xd1d5db, 0.9, 0);
  const fabricDark = std(0xc3c7cd, 0.92, 0);
  const oak = std(0xb48a60, 0.4, 0.02);
  const y0 = 0.12, base = 0.3, seatW = (s.width - 2 * s.armW) / 3, chaiseD = s.depth - s.mainDepth;
  g.add(box(s.width - 0.06, 0.05, s.mainDepth - 0.06, oak, [s.width / 2, 0.095, s.mainDepth / 2], 'Plinth_Main'));
  g.add(box(s.chaiseW - 0.06, 0.05, chaiseD, oak, [s.chaiseW / 2, 0.095, s.mainDepth + chaiseD / 2 - 0.03], 'Plinth_Chaise'));
  g.add(box(s.width, base - y0, s.mainDepth, fabricDark, [s.width / 2, (y0 + base) / 2, s.mainDepth / 2], 'Platform_Main'));
  g.add(box(s.chaiseW, base - y0, chaiseD, fabricDark, [s.chaiseW / 2, (y0 + base) / 2, s.mainDepth + chaiseD / 2], 'Platform_Chaise'));
  g.add(box(s.width, 0.62 - y0, 0.18, fabricDark, [s.width / 2, (0.62 + y0) / 2, 0.09], 'Back_Frame'));
  g.add(box(s.armW, 0.6 - y0, s.depth, fabricDark, [s.armW / 2, (0.6 + y0) / 2, s.depth / 2], 'Arm_Left_Chaise'));
  g.add(box(s.armW, 0.6 - y0, s.mainDepth, fabricDark, [s.width - s.armW / 2, (0.6 + y0) / 2, s.mainDepth / 2], 'Arm_Right'));
  for (let k = 0; k < 3; k++) {
    const x = s.armW + (k + 0.5) * seatW;
    g.add(box(seatW - 0.008, s.seatTop - base, s.mainDepth - 0.18, fabric, [x, (base + s.seatTop) / 2, (0.18 + s.mainDepth) / 2], `Seat_Cushion_${k + 1}`));
    const pillow = box(seatW - 0.03, 0.34, 0.18, fabric, [x, s.seatTop + 0.16, 0.28], `Back_Pillow_${k + 1}`);
    pillow.rotation.x = -0.22;
    g.add(pillow);
  }
  g.add(box(seatW - 0.008, s.seatTop - base, chaiseD, fabric, [s.armW + seatW / 2, (base + s.seatTop) / 2, s.mainDepth + chaiseD / 2], 'Chaise_Cushion'));
  const throwPillow = (x: number, yaw: number, color: number, n: string) => {
    const p = box(0.4, 0.4, 0.12, std(color, 0.85, 0), [x, 0.6, 0.5], n);
    p.rotation.set(-0.75, yaw, 0, 'YXZ');
    g.add(p);
  };
  throwPillow(s.armW + 0.26, 0.42, 0xca8a04, 'Pillow_Mustard_L');
  throwPillow(s.armW + 1.62, -0.12, 0x0d9488, 'Pillow_Teal');
  throwPillow(s.width - s.armW - 0.25, -0.45, 0xca8a04, 'Pillow_Mustard_R');
  enableShadow(g);
  return g;
}

/** Meja kopi rendah walnut padat + kaki besi silang (X), buku arsitektur & lilin aromaterapi. */
function coffeeTablePlaceholder(w: number, d: number, h: number) {
  const g = new THREE.Group();
  g.name = 'Coffee_Table_Placeholder';
  const walnut = std(0x3d2617, 0.42, 0.05);
  const iron = std(0x1a1c1f, 0.5, 0.7);
  g.add(box(w, 0.05, d, walnut, [0, h - 0.025, 0], 'Top_Walnut'));
  [-1, 1].forEach((sx) => {
    const a = box(0.025, Math.hypot(h - 0.05, d - 0.08), 0.025, iron, [sx * (w / 2 - 0.08), (h - 0.05) / 2, 0], 'Cross_Leg_A');
    a.rotation.x = Math.atan2(d - 0.08, h - 0.05);
    const b = a.clone(); b.name = 'Cross_Leg_B'; b.rotation.x = -a.rotation.x;
    g.add(a, b);
  });
  g.add(box(0.26, 0.04, 0.2, std(0xe8e2d4, 0.8, 0), [-0.2, h + 0.02, 0.05], 'Book_Architecture'));
  g.add(box(0.24, 0.03, 0.18, std(0x1f4d55, 0.8, 0), [-0.2, h + 0.055, 0.05], 'Book_Architecture_2'));
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 20), std(0xf4ede0, 0.6, 0));
  candle.position.set(0.25, h + 0.04, -0.08);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
  flame.position.set(0.25, h + 0.095, -0.08);
  g.add(candle, flame);
  enableShadow(g);
  return g;
}

/** Lampu lantai melengkung: kaki marmer, tiang baja busur, kubah kuningan di (dx, y, dz). */
function arcLampPlaceholder(dx: number, shadeY: number, dz: number) {
  const g = new THREE.Group();
  g.name = 'Arc_Lamp_Placeholder';
  const steel = std(0xc9d0d6, 0.25, 0.9);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 28), std(0xf1f5f9, 0.25, 0.05));
  base.position.y = 0.03;
  const pts = [new THREE.Vector3(0, 0.06, 0), new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(dx * 0.25, 2.1, dz * 0.25), new THREE.Vector3(dx * 0.8, 2.2, dz * 0.8), new THREE.Vector3(dx, shadeY + 0.18, dz)];
  const pole = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.012, 8, false), steel);
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0xc9a24a, 0.3, 0.9, { side: THREE.DoubleSide }));
  shade.position.set(dx, shadeY, dz);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }));
  bulb.position.set(dx, shadeY - 0.03, dz);
  g.add(base, pole, shade, bulb);
  enableShadow(g);
  return g;
}

/**
 * Areca palm, kontrak GLB `Office_Plant_Areca_Palm`: pot terakota Ø0,44 (bawah Ø0,34) × 0,42,
 * tinggi total 1,70, seluruh kanopi di dalam silinder Ø1,10. Origin = lantai di tengah pot.
 */
function arecaPalmPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Areca_Palm_Placeholder';
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 24), std(0xb5613b, 0.7, 0));
  pot.position.y = 0.21;
  g.add(pot);
  const frond = std(0x4f8a3c, 0.75, 0);
  const stemMat = std(0x6b7a3a, 0.7, 0);
  for (let i = 0; i < 9; i++) {
    // Pelepah: batang miring dari tanah, daun kerucut pipih di ujungnya; jangkauan maks. ±0,55 m.
    const a = i * 2.4, tilt = 0.1 + (i % 3) * 0.07, len = 0.95 + (i % 4) * 0.1;
    const dir = new THREE.Vector3(Math.sin(a) * Math.sin(tilt), Math.cos(tilt), Math.cos(a) * Math.sin(tilt));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, len, 6), stemMat);
    stem.position.set(dir.x * len / 2, 0.38 + dir.y * len / 2, dir.z * len / 2);
    stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const out = new THREE.Vector3(Math.sin(a), -0.35, Math.cos(a)).normalize();
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4, 1, true), frond);
    leaf.position.set(dir.x * len + out.x * 0.12, 0.38 + dir.y * len + out.y * 0.12, dir.z * len + out.z * 0.12);
    leaf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
    leaf.scale.set(1, 1, 0.25);
    g.add(stem, leaf);
  }
  enableShadow(g);
  return g;
}

/**
 * Rak majalah stainless, kontrak GLB `Office_Lounge_Magazine_Rack`: 0,34 × 0,90 × 0,30, depan +Z.
 * Rangka samping 15 mm, 3 baki selebar 0,31 miring 20° (depan rendah + bibir 25 mm) di Y 0,25/0,55/0,85.
 */
function magazineRackPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Magazine_Rack_Placeholder';
  const steel = std(0xc9d0d6, 0.25, 0.9);
  for (const x of [-0.1625, 0.1625]) {
    g.add(box(0.015, 0.015, 0.3, steel, [x, 0.0075, 0], 'Runner'));
    g.add(box(0.015, 0.885, 0.015, steel, [x, 0.4575, 0.1], 'Upright_F'));
    g.add(box(0.015, 0.885, 0.015, steel, [x, 0.4575, -0.1], 'Upright_B'));
    g.add(box(0.015, 0.015, 0.215, steel, [x, 0.8925, 0], 'Top_Rail'));
  }
  [0.25, 0.55, 0.85].forEach((y, i) => {
    const tray = new THREE.Group();
    tray.position.set(0, y - 0.0376, 0.1034);
    tray.rotation.x = 0.349;
    tray.add(box(0.31, 0.004, 0.22, steel, [0, 0, -0.11], `Tray_${i}`));
    tray.add(box(0.31, 0.025, 0.003, steel, [0, 0.0125, 0], `Tray_Lip_${i}`));
    tray.add(box(0.2, 0.005, 0.25, std([0xc9973a, 0x1f4d55, 0xb5523b][i]!, 0.6, 0), [0, 0.005, -0.129], `Magazine_${i}`));
    g.add(tray);
  });
  enableShadow(g);
  return g;
}
