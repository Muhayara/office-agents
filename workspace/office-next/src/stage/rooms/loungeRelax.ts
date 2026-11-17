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

  // ---- Sofa sudut L (sectional) di pojok barat daya; origin GLB = pusat bounding box sofa ----
  {
    const c = sofaCenter();
    mountAsset(slot(furniture, 'Sectional_L_Sofa', c.x, 0, c.z), '/models/Office_Lounge_Sectional_Sofa.glb', sectionalSofaPlaceholder(), load);
  }

  // ---- Meja kopi rendah walnut + kaki besi silang ----
  {
    const t = LOUNGE.coffeeTable;
    mountAsset(slot(furniture, 'Coffee_Table_Walnut', t.x, 0, t.z), '/models/Office_Lounge_Coffee_Table.glb', coffeeTablePlaceholder(t.w, t.d, t.h), load);
  }

  // ---- Lampu lantai melengkung (kubah kuningan) + cahaya hangat ----
  {
    const l = LOUNGE.arcLamp;
    mountAsset(slot(furniture, 'Arc_Floor_Lamp', l.baseX, 0, l.baseZ), '/models/Office_Lounge_Arc_Floor_Lamp.glb', arcLampPlaceholder(l.shadeX - l.baseX, l.shadeY, l.shadeZ - l.baseZ), load);
    const light = new THREE.PointLight(0xffcf9a, 12, 5.5, 1.7);
    light.name = 'Arc_Lamp_Warm_Light';
    light.position.set(l.shadeX, l.shadeY - 0.15, l.shadeZ);
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
/** Pusat bounding box sofa L di koordinat ruangan (= origin GLB sofa). */
function sofaCenter() {
  const s = LOUNGE.sofa;
  return { x: (s.longX0 + s.shortX1) / 2, z: (s.longZ0 + s.z1) / 2 };
}

/**
 * Sofa sudut L 2,20 × 3,36 m, origin = pusat bounding box (dunia ruangan: lengan panjang
 * X -2.5..-1.6 × Z -0.6..2.76 menghadap Timur, lengan pendek X -1.6..-0.3 × Z 1.86..2.76
 * menghadap Utara). Fabric krem / abu terang + bantal mustard & teal. Depan lengan panjang = +X.
 */
function sectionalSofaPlaceholder() {
  const s = LOUNGE.sofa;
  const root = new THREE.Group();
  root.name = 'Sectional_Sofa_Placeholder';
  const c = sofaCenter();
  const g = new THREE.Group();
  g.position.set(-c.x, 0, -c.z);
  root.add(g);
  const fabric = std(0xd9d2c5, 0.95, 0);
  const fabricDark = std(0xc6beaf, 0.95, 0);
  const legMat = std(0x2d2016, 0.5, 0.05);
  const baseH = 0.28, seatT = 0.15;
  // Lengan panjang (barat)
  const lw = s.longX1 - s.longX0, ll = s.z1 - s.longZ0, lcx = (s.longX0 + s.longX1) / 2, lcz = (s.longZ0 + s.z1) / 2;
  g.add(box(lw, baseH, ll, fabricDark, [lcx, 0.06 + baseH / 2, lcz], 'Long_Base'));
  g.add(box(lw - 0.2, seatT, ll - 0.22, fabric, [lcx + 0.1, 0.06 + baseH + seatT / 2, lcz - 0.06], 'Long_Seat_Cushion'));
  g.add(box(0.2, s.backTop - 0.06, ll, fabricDark, [s.longX0 + 0.1, 0.06 + (s.backTop - 0.06) / 2, lcz], 'Long_Backrest'));
  g.add(box(lw, 0.2, 0.18, fabricDark, [lcx, 0.06 + baseH + 0.1, s.longZ0 + 0.09], 'Long_Arm_North'));
  // Lengan pendek (selatan)
  const sw = s.shortX1 - s.longX1, sd = s.z1 - s.shortZ0, scx = (s.longX1 + s.shortX1) / 2, scz = (s.shortZ0 + s.z1) / 2;
  g.add(box(sw, baseH, sd, fabricDark, [scx, 0.06 + baseH / 2, scz], 'Short_Base'));
  g.add(box(sw - 0.18, seatT, sd - 0.2, fabric, [scx - 0.09, 0.06 + baseH + seatT / 2, scz - 0.1], 'Short_Seat_Cushion'));
  g.add(box(sw, s.backTop - 0.06, 0.2, fabricDark, [scx, 0.06 + (s.backTop - 0.06) / 2, s.z1 - 0.1], 'Short_Backrest'));
  g.add(box(0.18, 0.2, sd, fabricDark, [s.shortX1 - 0.09, 0.06 + baseH + 0.1, scz], 'Short_Arm_East'));
  // Kaki walnut pendek
  [[s.longX0 + 0.06, s.longZ0 + 0.06], [s.longX1 - 0.06, s.longZ0 + 0.06], [s.longX0 + 0.06, s.z1 - 0.06], [s.shortX1 - 0.06, s.z1 - 0.06], [s.shortX1 - 0.06, s.shortZ0 + 0.06]]
    .forEach(([x, z], i) => g.add(box(0.05, 0.06, 0.05, legMat, [x!, 0.03, z!], `Leg_${i}`)));
  // Bantal aksen mustard & teal
  const pillow = (x: number, z: number, rotY: number, color: number, n: string) => {
    const p = box(0.42, 0.4, 0.12, std(color, 0.9, 0), [x, 0.06 + baseH + seatT + 0.2, z], n);
    p.rotation.y = rotY; p.rotation.x = -0.15;
    g.add(p);
  };
  pillow(s.longX0 + 0.3, -0.35, Math.PI / 2, 0xd4a017, 'Pillow_Mustard');
  pillow(s.longX0 + 0.3, 1.25, Math.PI / 2, 0x0f6b6b, 'Pillow_Teal');
  pillow(-0.55, s.z1 - 0.3, 0, 0xd4a017, 'Pillow_Mustard_2');
  enableShadow(root);
  return root;
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

/** Areca palm dalam pot terakota (± 1,7 m). */
function arecaPalmPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Areca_Palm_Placeholder';
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 24), std(0xb5613b, 0.7, 0));
  pot.position.y = 0.21;
  g.add(pot);
  const frond = std(0x4f8a3c, 0.75, 0);
  const stemMat = std(0x6b7a3a, 0.7, 0);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, tilt = 0.35 + (i % 3) * 0.12, len = 1.1 + (i % 4) * 0.12;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, len, 6), stemMat);
    stem.position.set(Math.sin(a) * Math.sin(tilt) * len / 2, 0.42 + Math.cos(tilt) * len / 2, Math.cos(a) * Math.sin(tilt) * len / 2);
    stem.rotation.set(Math.cos(a) * tilt, 0, -Math.sin(a) * tilt);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, len * 0.75, 4, 1, true), frond);
    leaf.position.set(Math.sin(a) * Math.sin(tilt) * len * 0.8, 0.42 + Math.cos(tilt) * len * 0.8, Math.cos(a) * Math.sin(tilt) * len * 0.8);
    leaf.rotation.copy(stem.rotation);
    leaf.scale.set(1, 1, 0.25);
    g.add(stem, leaf);
  }
  enableShadow(g);
  return g;
}

/** Rak majalah berdiri stainless (0,36 × 0,9 × 0,3 m), depan = +Z. */
function magazineRackPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Magazine_Rack_Placeholder';
  const steel = std(0xc9d0d6, 0.25, 0.9);
  for (const x of [-0.17, 0.17]) g.add(box(0.015, 0.9, 0.3, steel, [x, 0.45, 0], 'Side'));
  [0.25, 0.55, 0.85].forEach((y, i) => {
    const shelf = box(0.34, 0.012, 0.22, steel, [0, y, 0.02], `Shelf_${i}`);
    shelf.rotation.x = -0.35;
    g.add(shelf);
    const mag = box(0.21, 0.28, 0.01, std([0xb5523b, 0x1f4d55, 0xc9973a][i]!, 0.6, 0), [0, y + 0.1, 0.06], `Magazine_${i}`);
    mag.rotation.x = -0.35;
    g.add(mag);
  });
  enableShadow(g);
  return g;
}
