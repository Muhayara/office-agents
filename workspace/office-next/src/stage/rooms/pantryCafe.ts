import * as THREE from 'three';
import { PANTRY, ROOM_PANTRY, WALL_HEIGHT } from '../layout';
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
import { brassMat, glassWallMats } from './walls';

/**
 * LAYER RUANGAN TAHAP 2: Room_PantryCafe, pusat dunia (6.5, 10.4), 5 × 6 m.
 *
 * Ruang sosial agen; menuntaskan relokasi Coffee Bar, Water Dispenser, dan Trash Bin dari
 * sudut barat daya Ruang Kerja.
 * - Utara : kaca bening frameless, bukaan terbuka 1,4 m ke Jalan Utama + ambang kuningan.
 * - Barat : Coffee Bar (menghadap Timur), dispenser, kabinet utilitas tinggi (kulkas + microwave).
 *           Dinding dalam ke calon Lobi: selalu memudar, perabotnya tetap solid.
 * - Selatan: kitchen counter + sink, backsplash subway tile, rak gantung.
 * - Tengah : bar island membujur Utara–Selatan dengan 4 kursi bar menghadap Timur.
 * - Timur : dinding dalam ke calon Lounge (Tahap 3), selalu memudar.
 */
export interface PantryCafe {
  group: THREE.Group;
  bindWalls: () => void;
  focusPoint: () => THREE.Vector3;
}

export function buildPantryCafe(load: ModelLoader, fader: WallFader): PantryCafe {
  const shell = buildSouthRoomShell({
    spec: ROOM_PANTRY,
    fader,
    fadeId: 'pantry',
    glass: { ...glassWallMats(), threshold: brassMat() },
    interiorSides: ['west', 'east'],
  });
  const { group, sub, inner, walls } = shell;
  const floor = sub('SubLayer_Floor');
  const coffee = sub('SubLayer_CoffeeStation');
  const kitchen = sub('SubLayer_Kitchen');
  const bar = sub('SubLayer_BarIsland');
  const decor = sub('SubLayer_Decor');

  const slot = (parent: THREE.Group, name: string, x: number, y: number, z: number, rotY = 0) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);
    return g;
  };

  // ---- Lantai keramik mozaik abu-abu doff (tahan tumpahan) ----
  {
    const W = inner.maxX - inner.minX;
    const D = inner.maxZ - inner.minZ;
    const tiles = meterBox(W, 0.02, D, mosaicTileMaterial(), [0, -0.01, 0], 'Pantry_Mosaic_Tiles');
    floor.add(tiles);
  }

  // ---- Stasiun kopi di dinding barat (pindahan dari Ruang Kerja) ----
  {
    const b = PANTRY.coffeeBar;
    mountAsset(slot(coffee, 'Office_Coffee_Bar', b.x, 0, b.z, b.rotY), '/models/Office_Coffee_Bar.glb', new THREE.Group(), load);
    const d = PANTRY.waterDispenser;
    mountAsset(slot(coffee, 'Office_Water_Dispenser', d.x, 0, d.z, d.rotY), '/models/Office_Water_Dispenser.glb', new THREE.Group(), load);

    const light = new THREE.PointLight(0xffdfb8, 22, 5, 1.6);
    light.name = 'Barista_Light';
    const l = PANTRY.baristaLight;
    light.position.set(l.x, l.y, l.z);
    coffee.add(light);

    const menu = PANTRY.menuBoard;
    const board = menuBoard();
    board.position.set(menu.x, menu.y, menu.z);
    board.rotation.y = Math.PI / 2;
    coffee.add(board);
  }

  // ---- Kabinet utilitas tinggi (kulkas mini + microwave) di sudut barat daya ----
  {
    const u = PANTRY.utility;
    mountAsset(slot(kitchen, 'Pantry_Utility_Cabinet', u.x, 0, u.z, u.rotY), '/models/Office_Pantry_Utility_Cabinet.glb', utilityPlaceholder(u.w, u.d, u.h), load);
  }

  // ---- Kitchen counter + sink di dinding selatan ----
  {
    const c = PANTRY.counter;
    // Origin GLB di tengah sisi belakang: slot tepat di muka dinding selatan.
    mountAsset(slot(kitchen, 'Kitchen_Counter_Sink', c.x, 0, c.z, c.rotY), '/models/Office_Pantry_Kitchen_Counter.glb', counterPlaceholder(c.length, c.depth, c.top, c.splashTop), load);

    // Subway tile lanjutan di atas backsplash counter + rak gantung: menempel dinding selatan
    // (ikut memudar). Backsplash 0,90–1,25 m milik counter (GLB / placeholder).
    const face = inner.maxZ;
    const x0 = c.x - c.length / 2;
    const x1 = c.x + c.length / 2;
    const tileH = 1.7 - c.splashTop;
    const tile = meterBox(x1 - x0, tileH, 0.012, subwayTileMaterial(), [(x0 + x1) / 2, c.splashTop + tileH / 2, face - 0.006], 'Subway_Tile_Upper');
    const shelfY = 1.98;
    const oak = std(0xb88a5a, 0.55, 0.05);
    const shelf = box(2.2, 0.035, 0.22, oak, [c.x, shelfY, face - 0.11], 'Hanging_Shelf');
    const brackets = [c.x - 0.95, c.x + 0.95].map((x) => box(0.025, 0.16, 0.2, std(0x1c2226, 0.45, 0.75), [x, shelfY - 0.09, face - 0.1], 'Shelf_Bracket'));
    const items = new THREE.Group();
    items.name = 'Shelf_Items';
    const cupMat = std(0xf3f1ec, 0.3, 0.05);
    for (let i = 0; i < 6; i++) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.034, 0.09, 12), cupMat);
      cup.position.set(c.x - 0.9 + i * 0.13, shelfY + 0.063, face - 0.1);
      items.add(cup);
    }
    const jarMat = new THREE.MeshStandardMaterial({ color: 0xc9e2e6, roughness: 0.1, transparent: true, opacity: 0.55 });
    const beanMat = std(0x3a2416, 0.8, 0);
    [0.15, 0.36, 0.57].forEach((dx, i) => {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.18 - i * 0.02, 16), jarMat);
      jar.position.set(c.x + dx, shelfY + 0.1, face - 0.1);
      const beans = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1 - i * 0.02, 16), beanMat);
      beans.position.set(c.x + dx, shelfY + 0.068, face - 0.1);
      items.add(jar, beans);
    });
    const plantPot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.12, 16), std(0xd9d4cc, 0.6, 0));
    plantPot.position.set(c.x + 0.9, shelfY + 0.077, face - 0.1);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), std(0x3f7a4a, 0.8, 0));
    leaves.position.set(c.x + 0.9, shelfY + 0.2, face - 0.1);
    leaves.scale.set(1, 0.8, 1);
    items.add(plantPot, leaves);
    walls.south.add(tile, shelf, ...brackets, items);
  }

  // ---- Bar island + 4 kursi bar tinggi + 3 lampu gantung ----
  {
    const i = PANTRY.island;
    mountAsset(slot(bar, 'Bar_Island', i.x, 0, i.z), '/models/Office_Pantry_Bar_Island.glb', islandPlaceholder(i.w, i.d, i.h), load);
    PANTRY.stoolZ.forEach((z, k) => {
      mountAsset(slot(bar, `Bar_Stool_${k}`, PANTRY.stoolX, 0, z, PANTRY.stoolRotY), '/models/Office_Pantry_Bar_Stool.glb', stoolPlaceholder(), load);
    });
    const shadeMat = std(0x1b2226, 0.4, 0.7);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0 });
    const cableMat = std(0x111111, 0.5, 0.2);
    [-0.8, 0, 0.8].map((dz) => i.z + dz).forEach((dz, k) => {
      const y = WALL_HEIGHT - 1.05;
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.16, 24, 1, true), shadeMat);
      shade.position.set(i.x, y, dz);
      shade.name = `Island_Pendant_${k}`;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), bulbMat);
      bulb.position.set(i.x, y - 0.06, dz);
      const cable = box(0.008, WALL_HEIGHT - y - 0.08, 0.008, cableMat, [i.x, (WALL_HEIGHT + y + 0.08) / 2, dz], 'Pendant_Cable');
      cable.castShadow = false;
      bar.add(shade, bulb, cable);
    });
  }

  // ---- Tempat sampah daur ulang di samping pintu ----
  {
    const t = PANTRY.trashBin;
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.52, 16), std(0x334155, 0.35, 0.8));
    bin.position.set(t.x, 0.26, t.z);
    bin.castShadow = true;
    bin.name = 'Trash_Bin';
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 16), std(0x16a34a, 0.4, 0.3));
    lid.position.set(t.x, 0.535, t.z);
    lid.name = 'Trash_Bin_Recycle_Lid';
    decor.add(bin, lid);
  }

  // ---- Tanaman ----
  {
    const plant = (url: string, name: string, p: { x: number; z: number }, s: number) => {
      const g = slot(decor, name, p.x, 0, p.z);
      g.scale.setScalar(s);
      mountAsset(g, url, new THREE.Group(), load);
    };
    plant('/models/Office_Indoor_Plant_SnakePlant.glb', 'Plant_NW', PANTRY.plantNW, 0.85);
    plant('/models/Office_Indoor_Plant.glb', 'Plant_SE', PANTRY.plantSE, 0.8);
  }

  return {
    group,
    bindWalls: shell.bindWalls,
    focusPoint: () => shell.local(0.2, 1.05, 0.3),
  };
}

// ============================================================================
// Tekstur prosedural (skala UV meterBox: 1 unit = 1 m)
// ============================================================================
/** Mozaik 10 × 10 keping per meter, abu-abu doff dengan variasi halus + nat gelap. */
function mosaicTileMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#4a5157';
  c.fillRect(0, 0, 256, 256);
  let seed = 11;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const n = 10;
  const s = 256 / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = 128 + Math.floor((rnd() - 0.5) * 22);
      c.fillStyle = `rgb(${v - 6}, ${v}, ${v + 4})`;
      c.fillRect(x * s + 1.2, y * s + 1.2, s - 2.4, s - 2.4);
    }
  }
  const tex = canvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.82, 0.02, { map: tex });
}

/** Subway tile putih 15 × 7,5 cm, susun bata, nat abu-abu muda. */
function subwayTileMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#b9c0c4';
  c.fillRect(0, 0, 256, 256);
  const rows = 13.33;
  const th = 256 / rows;
  const tw = th * 2;
  for (let r = 0; r < Math.ceil(rows); r++) {
    const off = r % 2 === 0 ? 0 : tw / 2;
    for (let x = -tw; x < 256 + tw; x += tw) {
      c.fillStyle = '#eef1f2';
      c.fillRect(x + off + 1, r * th + 1, tw - 2, th - 2);
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.fillRect(x + off + 2, r * th + 2, tw - 4, 2);
    }
  }
  const tex = canvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return std(0xffffff, 0.25, 0.05, { map: tex });
}

/** Papan menu kapur di atas coffee bar (depan = +Z). */
function menuBoard() {
  const g = new THREE.Group();
  g.name = 'Pantry_Menu_Board';
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 300;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#1d2622';
  c.fillRect(0, 0, 512, 300);
  c.textBaseline = 'middle';
  c.fillStyle = '#f5f0e6';
  c.font = '700 40px "Inter", system-ui, sans-serif';
  c.fillText('PANTRY · CAFÉ', 28, 44);
  c.fillStyle = '#e9a23b';
  c.fillRect(28, 74, 120, 4);
  const items: Array<[string, string]> = [
    ['Espresso', 'single / double'],
    ['Kopi Susu Gula Aren', 'dingin / panas'],
    ['Teh Melati', 'seduh tubruk'],
    ['Air Mineral', 'dispenser'],
  ];
  items.forEach(([name, note], i) => {
    const y = 116 + i * 46;
    c.fillStyle = '#f5f0e6';
    c.font = '600 28px "Inter", system-ui, sans-serif';
    c.fillText(name, 28, y);
    c.fillStyle = '#a3b2aa';
    c.font = '400 20px "Inter", system-ui, sans-serif';
    c.fillText(note, 330, y + 2);
  });
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.5),
    new THREE.MeshStandardMaterial({ map: canvasTexture(canvas), roughness: 0.9, metalness: 0 }),
  );
  face.position.z = 0.022;
  face.name = 'Menu_Face';
  const frame = box(0.92, 0.56, 0.03, std(0x4a2a17, 0.5, 0.05), [0, 0, 0.0], 'Menu_Frame');
  frame.castShadow = false;
  g.add(frame, face);
  return g;
}

// ============================================================================
// Placeholder prosedural (otomatis diganti GLB bila file-nya ada di public/models)
// ============================================================================
/**
 * Kitchen counter + sink (kontrak Office_Pantry_Kitchen_Counter.glb): panjang di sumbu X,
 * origin di tengah sisi BELAKANG (z = 0), depan = +Z sampai z = depth. Atas marmer `top`,
 * backsplash subway tile sampai `splashTop`, bak cuci di X +0.6.
 */
function counterPlaceholder(length: number, depth: number, top: number, splashTop: number) {
  const g = new THREE.Group();
  g.name = 'Kitchen_Counter_Placeholder';
  const oak = std(0xb89772, 0.4, 0.02);
  const marble = std(0xf1f5f9, 0.22, 0.05);
  const dark = std(0x1a1f23, 0.6, 0.2);
  const pull = std(0x1e293b, 0.35, 0.8);
  const steel = std(0xcbd5e1, 0.2, 0.92);
  const cz = depth / 2;
  g.add(box(length - 0.04, 0.1, depth - 0.1, dark, [0, 0.05, cz - 0.04], 'Toe_Kick'));
  g.add(box(length, top - 0.13, depth - 0.03, oak, [0, 0.1 + (top - 0.13) / 2, cz - 0.015], 'Base_Cabinets'));
  g.add(box(length, 0.03, depth, marble, [0, top - 0.015, cz], 'Marble_Top'));
  g.add(meterBox(length, splashTop - top, 0.015, subwayTileMaterial(), [0, (top + splashTop) / 2, 0.0075], 'Backsplash_Tiles'));
  // 4 bay pintu + gagang hitam 150 mm
  const bays = 4;
  const bw = length / bays;
  for (let b = 0; b < bays; b++) {
    const x = -length / 2 + bw * (b + 0.5);
    g.add(box(0.006, top - 0.15, 0.01, dark, [x - bw / 2, 0.1 + (top - 0.15) / 2, depth - 0.025], 'Bay_Gap'));
    g.add(box(0.15, 0.012, 0.02, pull, [x, top - 0.1, depth - 0.01], 'Edge_Pull'));
  }
  // Bak cuci undermount + keran leher angsa
  g.add(box(0.5, 0.006, 0.4, std(0x2b3034, 0.3, 0.6), [0.6, top + 0.001, cz + 0.02], 'Sink_Opening'));
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.3, 12), steel);
  tap.position.set(0.6, top + 0.15, 0.08);
  const spout = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 16, Math.PI), steel);
  spout.position.set(0.6, top + 0.3, 0.17);
  spout.rotation.y = Math.PI / 2;
  g.add(tap, spout);
  enableShadow(g);
  return g;
}

/**
 * Kabinet utilitas tinggi (kontrak Office_Pantry_Utility_Cabinet.glb): origin di tengah sisi
 * BELAKANG (z = 0), depan = +Z. Kulkas kaca 0–0,85 m, ceruk microwave 0,85–1,35 m, lemari atas.
 */
function utilityPlaceholder(w: number, d: number, h: number) {
  const g = new THREE.Group();
  g.name = 'Utility_Cabinet_Placeholder';
  const slate = std(0x1e293b, 0.4, 0.05);
  const steel = std(0xc3cbd0, 0.28, 0.85);
  const dark = std(0x0b0f12, 0.3, 0.4);
  const front = d;
  g.add(box(w, h, d - 0.02, slate, [0, h / 2, d / 2 - 0.01], 'Carcass'));
  g.add(box(w - 0.06, 0.78, 0.02, std(0x1a3550, 0.15, 0.3, { emissive: 0x60a5fa, emissiveIntensity: 0.35 }), [0, 0.44, front], 'Cooler_Glass_Door'));
  g.add(box(w - 0.08, 0.46, 0.04, steel, [0, 1.1, front - 0.03], 'Microwave_Alcove'));
  g.add(box(w - 0.2, 0.3, 0.02, dark, [-0.04, 1.08, front - 0.005], 'Microwave'));
  g.add(box(0.08, 0.04, 0.01, new THREE.MeshBasicMaterial({ color: 0x4ade80 }), [w / 2 - 0.14, 1.17, front + 0.006], 'Microwave_Clock'));
  g.add(box(0.006, h - 1.37, 0.01, dark, [0, (1.35 + h) / 2, front + 0.002], 'Upper_Door_Gap'));
  enableShadow(g);
  return g;
}

/** Bar island membujur di sumbu Z (lebar w di X), tinggi h; rangka trestle baja + footrest tengah. */
function islandPlaceholder(w: number, d: number, h: number) {
  const g = new THREE.Group();
  g.name = 'Bar_Island_Placeholder';
  const walnut = std(0x2d2016, 0.32, 0.03);
  const steel = std(0x18191c, 0.55, 0.75);
  g.add(box(w, 0.05, d, walnut, [0, h - 0.025, 0], 'Island_Top'));
  for (const z of [-(d / 2 - 0.3), d / 2 - 0.3]) {
    g.add(box(0.06, h - 0.05, 0.06, steel, [0, (h - 0.05) / 2, z], 'Trestle_Post'));
    g.add(box(w - 0.12, 0.06, 0.06, steel, [0, 0.03, z], 'Trestle_Foot'));
    g.add(box(w - 0.12, 0.06, 0.06, steel, [0, h - 0.08, z], 'Trestle_Head'));
  }
  g.add(box(0.06, 0.06, d - 0.6, steel, [0, 0.28, 0], 'Footrest_Stretcher'));
  g.add(box(0.3, 0.04, 0.16, std(0xc9a46b, 0.6, 0.02), [0, h + 0.02, 0], 'Condiment_Tray'));
  enableShadow(g);
  return g;
}

/** Kursi bar (kontrak Office_Pantry_Bar_Stool.glb): dudukan 0,75 m, sandaran rendah di -Z, depan = +Z. */
function stoolPlaceholder() {
  const g = new THREE.Group();
  g.name = 'Bar_Stool_Placeholder';
  const steel = std(0x1e242b, 0.4, 0.8);
  const leather = std(0x92542a, 0.58, 0.05);
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.07, 24), leather);
  seat.position.y = 0.715;
  g.add(seat);
  for (const x of [-0.17, 0.17]) for (const z of [-0.17, 0.17]) {
    g.add(box(0.018, 0.68, 0.018, steel, [x, 0.34, z], 'Leg'));
  }
  for (const [x, z, w, dd] of [[0, -0.17, 0.36, 0.014], [0, 0.17, 0.36, 0.014], [-0.17, 0, 0.014, 0.36], [0.17, 0, 0.014, 0.36]] as const) {
    g.add(box(w, 0.014, dd, steel, [x, 0.28, z], 'Footrest_Ring'));
  }
  const back = box(0.34, 0.12, 0.04, leather, [0, 0.9, -0.19], 'Backrest');
  back.rotation.x = -0.12;
  g.add(back);
  enableShadow(g);
  return g;
}
