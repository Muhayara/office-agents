import * as THREE from 'three';
import { GARDEN, ROOM_GARDEN, type Pt, type Spot } from '../layout';
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

/**
 * LAYER RUANGAN TAHAP 4: Room_DigitalGarden, pusat dunia (24.5, 10.4), 5 × 6 m, sisi selatan bus.
 *
 * Oase biofilik untuk rehat agen: rumput sintetis, kerikil putih, batu pijakan slate, green wall,
 * fountain zen dengan air beranimasi, bangku teak, fiddle leaf fig, monstera & snake plant.
 * - Utara : kaca + pintu geser frameless otomatis 1,6 m ke Jalan Utama (selalu memudar).
 * - Barat : dinding timur Server / IT (tidak dibangun ulang, selalu memudar). Green wall berdiri di
 *           depannya hanya di separuh utara; separuh selatan fountain & tanaman rendah (≤ 1 m)
 *           supaya rak server tetap terlihat dari kamera Tenggara.
 * - Timur : dinding dalam ke calon Digital Access Hub (Tahap 6).
 * - Selatan: dinding luar + jendela panorama palsu (memudar di kamera isometrik).
 */
export interface DigitalGarden {
  group: THREE.Group;
  bindWalls: () => void;
  /** Titik duduk bangku (dunia) + titik berdiri di depan bangku. */
  seatsWorld: () => Array<{ spot: Spot; approach: Spot }>;
  update: (time: number, dt: number, agents: readonly Pt[]) => void;
  focusPoint: () => THREE.Vector3;
}

export function buildDigitalGarden(load: ModelLoader, fader: WallFader): DigitalGarden {
  const shell = buildSouthRoomShell({
    spec: ROOM_GARDEN,
    fader,
    fadeId: 'garden',
    glass: glassWallMats(),
    interiorSides: ['east'],
    sides: { west: false },
  });
  const { group, sub, inner, walls } = shell;
  const floor = sub('SubLayer_Ground');
  const green = sub('SubLayer_Greenery');
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

  // ---- Kerikil kali putih (dasar) + hamparan rumput sintetis + batu pijakan slate ----
  {
    const W = inner.maxX - inner.minX, D = inner.maxZ - inner.minZ;
    floor.add(meterBox(W, 0.02, D, gravelMaterial(), [(inner.minX + inner.maxX) / 2, -0.01, 0], 'White_River_Gravel'));
    const lawn = { minX: -1.8, maxX: 1.98, minZ: -2.2, maxZ: 2.42 };
    floor.add(meterBox(lawn.maxX - lawn.minX, 0.016, lawn.maxZ - lawn.minZ, grassMaterial(), [(lawn.minX + lawn.maxX) / 2, 0, (lawn.minZ + lawn.maxZ) / 2], 'Synthetic_Grass_Lawn'));
    const edge = std(0x2a2d30, 0.6, 0.4);
    const e = (w: number, d: number, x: number, z: number) => { const m = box(w, 0.03, d, edge, [x, 0.005, z], 'Lawn_Steel_Edging'); m.castShadow = false; floor.add(m); };
    e(lawn.maxX - lawn.minX + 0.02, 0.01, (lawn.minX + lawn.maxX) / 2, lawn.minZ);
    e(lawn.maxX - lawn.minX + 0.02, 0.01, (lawn.minX + lawn.maxX) / 2, lawn.maxZ);
    e(0.01, lawn.maxZ - lawn.minZ, lawn.minX, (lawn.minZ + lawn.maxZ) / 2);
    e(0.01, lawn.maxZ - lawn.minZ, lawn.maxX, (lawn.minZ + lawn.maxZ) / 2);

    // Batu pijakan mengikuti lorong agen (+ cabang ke fountain)
    const slate = std(0x5d646b, 0.82, 0.05);
    const pts: Pt[] = [];
    const lane = GARDEN.lane;
    for (let i = 0; i < lane.length - 1; i++) {
      const a = lane[i]!, b = lane[i + 1]!, L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.round(L / 0.5));
      for (let k = i === 0 ? 0 : 1; k <= n; k++) pts.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n });
    }
    [{ x: -1.05, z: 1.62 }, { x: -1.5, z: 1.7 }].forEach((p) => pts.push(p));
    const r = rnd(12);
    pts.forEach((p, i) => {
      const s = new THREE.Shape(), n = 9, R = 0.19 + r() * 0.05;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, rr = R * (0.82 + r() * 0.3);
        if (k === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 1 });
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, slate);
      m.name = `Slate_Stepping_Stone_${i}`;
      m.position.set(p.x + (r() - 0.5) * 0.06, -0.012, p.z + (r() - 0.5) * 0.06);
      m.rotation.y = r() * Math.PI;
      m.receiveShadow = true;
      floor.add(m);
    });
  }

  // ---- Green wall (separuh utara dinding barat, menghadap Timur) + lampu grow-light ----
  {
    const w = GARDEN.livingWall;
    mountAsset(slot(green, 'Living_Green_Wall', w.x, 0, w.z, w.rotY), '/models/Office_Garden_Living_Wall.glb', livingWallPlaceholder(w.w, w.h, w.d), load);
    const grow = new THREE.PointLight(0xeaffd8, 6, 3.4, 1.8);
    grow.name = 'Grow_Light_Glow';
    grow.position.set(w.x + 0.45, w.h - 0.25, w.z);
    decor.add(grow);
  }

  // ---- Fountain zen: GLB/placeholder + air beranimasi (overlay scene, tetap ada saat GLB dimuat) ----
  const water = waterOverlay(GARDEN.fountain.waterY);
  {
    const f = GARDEN.fountain;
    const fs = slot(furniture, 'Zen_Fountain', f.x, 0, f.z, f.rotY);
    fs.add(water.group);
    mountAsset(fs, '/models/Office_Garden_Zen_Fountain.glb', fountainPlaceholder(f.w, f.d), load);
  }

  // ---- Bangku teak tanpa sandaran (menghadap Selatan) ----
  {
    const b = GARDEN.bench;
    mountAsset(slot(furniture, 'Teak_Bench', b.x, 0, b.z, b.rotY), '/models/Office_Garden_Teak_Bench.glb', benchPlaceholder(b.w, b.d, b.h), load);
  }

  // ---- Tanaman: fiddle leaf fig tinggi, monstera, snake plant + batu zen ----
  {
    const f = GARDEN.fig;
    mountAsset(slot(green, 'Fiddle_Leaf_Fig', f.x, 0, f.z), '/models/Office_Plant_Fiddle_Leaf_Fig.glb', figPlaceholder(), load);
    const m = slot(green, 'Garden_Monstera', GARDEN.monstera.x, 0, GARDEN.monstera.z);
    mountAsset(m, '/models/Office_Indoor_Plant.glb', new THREE.Group(), load);
    const sn = slot(green, 'Garden_SnakePlant', GARDEN.snakePlant.x, 0, GARDEN.snakePlant.z);
    mountAsset(sn, '/models/Office_Indoor_Plant_SnakePlant.glb', new THREE.Group(), load);
    const rock = std(0x6b6f72, 0.9, 0.02);
    const r = rnd(5);
    ([[-1.6, 0.62, 0.26, 0.17], [-1.35, 2.42, 0.2, 0.13], [-1.95, -2.45, 0.22, 0.15]] as const).forEach(([x, z, s, h], i) => {
      // Polihedron three.js tidak berindeks: jitter dikunci ke POSISI verteks supaya sisi tidak retak.
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const p = geo.getAttribute('position'), seed = r() * 100;
      const hash = (x: number, y: number, z: number) => { const v = Math.sin(Math.round(x * 1e4) * 12.9898 + Math.round(y * 1e4) * 78.233 + Math.round(z * 1e4) * 37.719 + seed) * 43758.5453; return v - Math.floor(v); };
      for (let k = 0; k < p.count; k++) { const f2 = 0.85 + hash(p.getX(k), p.getY(k), p.getZ(k)) * 0.3; p.setXYZ(k, p.getX(k) * f2, p.getY(k) * f2, p.getZ(k) * f2); }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, rock);
      mesh.name = `Zen_Boulder_${i}`;
      mesh.scale.set(s, h, s * 0.8);
      mesh.position.set(x, h * 0.35, z);
      mesh.rotation.y = r() * Math.PI;
      mesh.castShadow = mesh.receiveShadow = true;
      decor.add(mesh);
    });
  }

  // ---- Jendela panorama di muka dalam dinding selatan (ikut memudar bersama dindingnya) ----
  {
    const w = GARDEN.window, cx = (w.xMin + w.xMax) / 2, cy = (w.yMin + w.yMax) / 2, face = inner.maxZ - 0.006;
    const view = new THREE.Mesh(new THREE.PlaneGeometry(w.xMax - w.xMin, w.yMax - w.yMin), new THREE.MeshBasicMaterial({ map: panoramaTexture(), toneMapped: false }));
    view.name = 'Panorama_Window_View';
    view.rotation.y = Math.PI;
    view.position.set(cx, cy, face);
    walls.south.add(view);
    const frame = std(0x1b1e21, 0.4, 0.6);
    const bar = (bw: number, bh: number, x: number, y: number, n: string) => walls.south.add(box(bw, bh, 0.04, frame, [x, y, face - 0.015], n));
    bar(w.xMax - w.xMin + 0.08, 0.05, cx, w.yMax, 'Window_Head');
    bar(w.xMax - w.xMin + 0.08, 0.05, cx, w.yMin, 'Window_Sill');
    [w.xMin, cx, w.xMax].forEach((x, i) => bar(0.05, w.yMax - w.yMin, x, cy, `Window_Mullion_${i}`));
  }

  // ---- Cahaya hangat "matahari" taman ----
  {
    const l = GARDEN.light;
    const sun = new THREE.PointLight(0xfff1d6, 10, 6.5, 1.6);
    sun.name = 'Garden_Warm_Light';
    sun.position.set(l.x, l.y, l.z);
    decor.add(sun);
  }

  // ---- Pintu kaca geser otomatis (bagian dinding utara: ikut memudar) ----
  const door = slidingGlassDoor({ name: 'Garden_Sliding_Door', span: ROOM_GARDEN.northDoor, wallZ: -ROOM_GARDEN.halfZ + 0.12, sense: GARDEN.doorSense, parent: group });
  walls.north.add(door.group);

  const toWorldSpot = (p: { x: number; z: number }, rotY = 0): Spot => {
    const v = shell.local(p.x, 0, p.z);
    return { x: v.x, z: v.z, rotY };
  };

  return {
    group,
    bindWalls: shell.bindWalls,
    seatsWorld: () => GARDEN.seats.map((s) => ({ spot: toWorldSpot(s.spot, s.spot.rotY), approach: toWorldSpot(s.approach, s.spot.rotY) })),
    update: (time, dt, agents) => {
      door.update(dt, agents);
      water.update(time);
    },
    focusPoint: () => shell.local(-0.1, 1.0, 0.2),
  };
}

// ============================================================================
// Air fountain: permukaan beriak + aliran jatuh dari pancuran bambu (lokal slot fountain)
// Kontrak GLB: pancuran berakhir di (0.03, 0.655, 0.05), air jatuh lurus ke permukaan Y waterY.
// ============================================================================
function waterOverlay(waterY: number) {
  const group = new THREE.Group();
  group.name = 'Fountain_Water_Overlay';
  const ripple = rippleTexture();
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping;
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.43),
    new THREE.MeshStandardMaterial({ color: 0x9fd3dc, map: ripple, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.9 }),
  );
  surface.name = 'Water_Surface';
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = waterY;
  surface.receiveShadow = true;
  const streamTex = streamTexture();
  streamTex.wrapS = streamTex.wrapT = THREE.RepeatWrapping;
  const streamH = 0.655 - waterY;
  const stream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.012, streamH, 10, 1, true),
    new THREE.MeshBasicMaterial({ map: streamTex, transparent: true, opacity: 0.75, depthWrite: false, color: 0xd9f3f7 }),
  );
  stream.name = 'Water_Stream';
  stream.position.set(0.03, waterY + streamH / 2, 0.05);
  const splash = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.05, 24), new THREE.MeshBasicMaterial({ color: 0xeefcff, transparent: true, opacity: 0.5, depthWrite: false }));
  splash.name = 'Water_Splash_Ring';
  splash.rotation.x = -Math.PI / 2;
  splash.position.set(0.03, waterY + 0.002, 0.05);
  group.add(surface, stream, splash);
  return {
    group,
    update: (time: number) => {
      ripple.offset.set(Math.sin(time * 0.35) * 0.04, time * 0.05);
      streamTex.offset.y = (time * 1.6) % 1;
      const k = 1 + ((time * 1.8) % 1) * 1.4;
      splash.scale.set(k, k, 1);
      (splash.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - ((time * 1.8) % 1));
    },
  };
}

// ============================================================================
// Tekstur prosedural
// ============================================================================
function rnd(seed: number) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

/** Kerikil kali putih, canvas = 1 m. */
function gravelMaterial() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#c9c6bf'; x.fillRect(0, 0, S, S);
  const r = rnd(3);
  for (let i = 0; i < 900; i++) {
    const g = 200 + r() * 50 | 0;
    x.fillStyle = `rgb(${g},${g - 3},${g - 9})`;
    x.beginPath(); x.ellipse(r() * S, r() * S, 2 + r() * 4, 1.5 + r() * 3, r() * Math.PI, 0, Math.PI * 2); x.fill();
    if (r() > 0.7) { x.fillStyle = 'rgba(90,88,84,0.35)'; x.fillRect(r() * S, r() * S, 1.5, 1.5); }
  }
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.92, 0, { map: tex });
}

/** Rumput sintetis pendek: helai halus dua warna, canvas = 1 m. */
function grassMaterial() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.fillStyle = '#4d7a32'; x.fillRect(0, 0, S, S);
  const r = rnd(8);
  for (let i = 0; i < 2600; i++) {
    const px = r() * S, py = r() * S, l = 2 + r() * 4, a = -Math.PI / 2 + (r() - 0.5) * 0.9;
    x.strokeStyle = r() > 0.5 ? 'rgba(112,160,70,0.7)' : 'rgba(52,92,34,0.7)';
    x.lineWidth = 1;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.95, 0, { map: tex });
}

/** Riak air: lingkaran konsentris lembut di atas biru kehijauan. */
function rippleTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#2f6670'); g.addColorStop(1, '#3f7f88');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const r = rnd(19);
  for (let i = 0; i < 14; i++) {
    const cx = r() * S, cy = r() * S;
    for (let k = 1; k <= 3; k++) { x.strokeStyle = `rgba(220,245,250,${0.22 / k})`; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cy, 8 * k + r() * 6, 0, Math.PI * 2); x.stroke(); }
  }
  return canvasTexture(c);
}

/** Aliran air jatuh: garis vertikal terang bergradasi. */
function streamTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(200,235,242,0.5)'; x.fillRect(0, 0, 32, 128);
  const r = rnd(27);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.5})`; x.fillRect(r() * 32, r() * 128, 1 + r() * 2, 6 + r() * 18); }
  return canvasTexture(c);
}

/** Pemandangan jendela panorama: langit sore, perbukitan hijau, pepohonan. */
function panoramaTexture() {
  const W = 800, H = 460, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  const sky = x.createLinearGradient(0, 0, 0, H * 0.62); sky.addColorStop(0, '#8fc3e6'); sky.addColorStop(1, '#e9f2ea');
  x.fillStyle = sky; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,0.75)';
  [[140, 70, 60], [430, 110, 80], [650, 60, 50]].forEach(([cx, cy, s]) => { x.beginPath(); x.ellipse(cx!, cy!, s!, s! * 0.32, 0, 0, Math.PI * 2); x.fill(); });
  x.fillStyle = '#7fa37a'; x.beginPath(); x.moveTo(0, H * 0.6); x.bezierCurveTo(W * 0.3, H * 0.45, W * 0.6, H * 0.62, W, H * 0.5); x.lineTo(W, H); x.lineTo(0, H); x.fill();
  x.fillStyle = '#4f7d45'; x.beginPath(); x.moveTo(0, H * 0.72); x.bezierCurveTo(W * 0.35, H * 0.62, W * 0.7, H * 0.78, W, H * 0.68); x.lineTo(W, H); x.lineTo(0, H); x.fill();
  const r = rnd(33);
  for (let i = 0; i < 26; i++) {
    const tx = r() * W, ty = H * (0.7 + r() * 0.12), s = 14 + r() * 22;
    x.fillStyle = r() > 0.5 ? '#2f5e2b' : '#3d7a35';
    x.beginPath(); x.arc(tx, ty - s, s, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#4a3a2a'; x.fillRect(tx - 2, ty - s * 0.2, 4, s * 0.8);
  }
  x.fillStyle = '#6a9a55'; x.fillRect(0, H * 0.88, W, H * 0.12);
  return canvasTexture(c);
}

// ============================================================================
// Placeholder prosedural (otomatis diganti GLB bila file-nya ada di public/models)
// ============================================================================
/**
 * Green wall, kontrak GLB `Office_Garden_Living_Wall`: lebar W (X) × tinggi H × tebal D, origin =
 * tengah sisi BELAKANG di lantai, depan +Z. Panel belakang gelap, rangka baja hitam, bak tanam di
 * bawah, ratusan daun pakis / philodendron / lumut (warna per verteks), strip LED grow-light di atas.
 */
function livingWallPlaceholder(W: number, H: number, D: number) {
  const g = new THREE.Group();
  g.name = 'Living_Wall_Placeholder';
  const steel = std(0x1b1e21, 0.5, 0.6);
  g.add(box(W, H, 0.04, std(0x1e2622, 0.95, 0), [0, H / 2, 0.02], 'Backing_Panel'));
  g.add(box(W, 0.2, D, steel, [0, 0.1, D / 2], 'Planter_Trough'));
  g.add(box(W, 0.05, D, steel, [0, H - 0.025, D / 2], 'Frame_Top'));
  for (const x of [-W / 2 + 0.025, W / 2 - 0.025]) g.add(box(0.05, H, D, steel, [x, H / 2, D / 2], 'Frame_Side'));
  const led = box(W - 0.12, 0.025, 0.035, new THREE.MeshBasicMaterial({ color: 0xfff6dc }), [0, H - 0.07, D - 0.03], 'Grow_Light_Strip');
  led.castShadow = false;
  g.add(led);

  // Daun: segi empat belah ketupat menghadap +Z dengan kemiringan acak, digabung jadi satu mesh.
  const r = rnd(77), P: number[] = [], C: number[] = [];
  const palette = ([[0.23, 0.45, 0.2], [0.18, 0.4, 0.22], [0.36, 0.55, 0.22], [0.47, 0.65, 0.29], [0.15, 0.33, 0.17]] as const).map(([a, b, c2]) => new THREE.Color(a, b, c2).convertSRGBToLinear());
  const v = (x: number, y: number, z: number) => P.push(x, y, z);
  for (let i = 0; i < 950; i++) {
    const cx = (r() - 0.5) * (W - 0.14), cy = 0.24 + r() * (H - 0.36), cz = 0.05 + r() * (D - 0.07);
    const kind = r(), s = kind < 0.35 ? 0.12 + r() * 0.08 : kind < 0.75 ? 0.08 + r() * 0.06 : 0.05 + r() * 0.03;
    const wide = kind < 0.35 ? 0.55 : kind < 0.75 ? 0.25 : 0.8;
    const a = -Math.PI / 2 + (r() - 0.5) * 2.6;
    const dx = Math.cos(a) * s, dy = Math.sin(a) * s, tz = 0.25 + r() * 0.5;
    const sx = -Math.sin(a) * s * wide * 0.5, sy = Math.cos(a) * s * wide * 0.5;
    const tip = [cx + dx, cy + dy, cz + s * tz], base = [cx - dx * 0.1, cy - dy * 0.1, cz], l = [cx + dx * 0.45 + sx, cy + dy * 0.45 + sy, cz + s * tz * 0.5], rr = [cx + dx * 0.45 - sx, cy + dy * 0.45 - sy, cz + s * tz * 0.5];
    v(base[0]!, base[1]!, base[2]!); v(l[0]!, l[1]!, l[2]!); v(tip[0]!, tip[1]!, tip[2]!);
    v(base[0]!, base[1]!, base[2]!); v(tip[0]!, tip[1]!, tip[2]!); v(rr[0]!, rr[1]!, rr[2]!);
    const col = palette[Math.floor(r() * palette.length)]!.clone().multiplyScalar(0.85 + r() * 0.3);
    for (let k = 0; k < 6; k++) C.push(col.r, col.g, col.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.computeVertexNormals();
  const leaves = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }));
  leaves.name = 'Foliage_Ferns_Philodendron_Moss';
  g.add(leaves);
  enableShadow(g, false, true);
  return g;
}

/**
 * Fountain zen, kontrak GLB `Office_Garden_Zen_Fountain`: W (X) × 0,85 × D (Z), origin lantai tengah,
 * depan +Z. Bak batu basalt (bibir 0,42, permukaan air 0,40 diisi overlay scene), tumpukan batu di
 * belakang kiri, pancuran bambu yang ujungnya di (0.03, 0.655, 0.05).
 */
function fountainPlaceholder(W: number, D: number) {
  const g = new THREE.Group();
  g.name = 'Zen_Fountain_Placeholder';
  const basalt = std(0x3a3d40, 0.85, 0.05);
  g.add(box(W, 0.06, D, basalt, [0, 0.03, 0], 'Basin_Floor'));
  for (const z of [-D / 2 + 0.03, D / 2 - 0.03]) g.add(box(W, 0.42, 0.06, basalt, [0, 0.21, z], 'Basin_Wall'));
  for (const x of [-W / 2 + 0.03, W / 2 - 0.03]) g.add(box(0.06, 0.42, D - 0.12, basalt, [x, 0.21, 0], 'Basin_Wall'));
  const stone = std(0x55595c, 0.9, 0.03);
  const r = rnd(61);
  [[0.24, 0.07, 0.19], [0.2, 0.07, 0.16], [0.17, 0.06, 0.14], [0.13, 0.05, 0.11]].forEach(([sx, sy, sz], i) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), stone);
    m.name = `Stacked_Stone_${i}`;
    m.scale.set(sx!, sy!, sz!);
    m.position.set(-0.24 + (r() - 0.5) * 0.03, 0.47 + i * 0.1, -0.12);
    m.rotation.y = r() * Math.PI;
    g.add(m);
  });
  const bamboo = std(0x9c8a4a, 0.6, 0.02);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 12), bamboo);
  post.name = 'Bamboo_Post';
  post.position.set(-0.12, 0.6, -0.17);
  const spoutLen = Math.hypot(0.15, 0.115, 0.22);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, spoutLen, 12), bamboo);
  spout.name = 'Bamboo_Spout';
  const a = new THREE.Vector3(-0.12, 0.77, -0.17), b = new THREE.Vector3(0.03, 0.655, 0.05);
  spout.position.copy(a).lerp(b, 0.5);
  spout.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.add(post, spout);
  enableShadow(g);
  return g;
}

/**
 * Bangku taman, kontrak GLB `Office_Garden_Teak_Bench`: W (X) × H × D (Z), origin lantai tengah,
 * dudukan teak 5 bilah setinggi H, 2 rangka-U besi hitam di X ±(W/2 − 0,22). Tanpa sandaran.
 */
function benchPlaceholder(W: number, D: number, H: number) {
  const g = new THREE.Group();
  g.name = 'Teak_Bench_Placeholder';
  const teak = std(0xa0703f, 0.55, 0.03);
  const iron = std(0x17191c, 0.5, 0.7);
  const n = 5, gap = 0.015, sw = (D - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) g.add(box(W, 0.035, sw, teak, [0, H - 0.0175, -D / 2 + sw / 2 + i * (sw + gap)], `Teak_Slat_${i + 1}`));
  for (const x of [-W / 2 + 0.22, W / 2 - 0.22]) {
    for (const z of [-D / 2 + 0.04, D / 2 - 0.04]) g.add(box(0.04, H - 0.035, 0.04, iron, [x, (H - 0.035) / 2, z], 'Iron_Leg'));
    g.add(box(0.04, 0.04, D - 0.04, iron, [x, H - 0.055, 0], 'Iron_Rail_Top'));
    g.add(box(0.04, 0.03, D - 0.04, iron, [x, 0.015, 0], 'Iron_Foot'));
  }
  enableShadow(g);
  return g;
}

/**
 * Fiddle leaf fig, kontrak GLB `Office_Plant_Fiddle_Leaf_Fig`: tinggi 2,0, kanopi ≤ Ø0,8, pot beton
 * Ø0,42 × 0,45. Origin = lantai di tengah pot.
 */
function figPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Fiddle_Leaf_Fig_Placeholder';
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.18, 0.45, 28), std(0x9c9b97, 0.9, 0.02));
  pot.position.y = 0.225;
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.01, 24), std(0x1c1917, 0.95, 0));
  soil.position.y = 0.42;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, 1.25, 10), std(0x6b5240, 0.9, 0));
  trunk.position.y = 0.42 + 0.625;
  g.add(pot, soil, trunk);
  const leafA = std(0x2f5e2b, 0.55, 0), leafB = std(0x3d7a35, 0.55, 0);
  for (let i = 0; i < 30; i++) {
    const t = i / 29, y = 1.0 + t * 0.86, a = i * 2.4, rad = 0.12 + 0.12 * Math.sin(Math.PI * t);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), i % 2 ? leafA : leafB);
    leaf.name = 'Fiddle_Leaf';
    leaf.scale.set(0.1, 0.15, 0.018);
    leaf.position.set(Math.sin(a) * rad, y, Math.cos(a) * rad);
    leaf.lookAt(Math.sin(a) * 2, y + 0.9, Math.cos(a) * 2);
    g.add(leaf);
  }
  enableShadow(g);
  return g;
}
