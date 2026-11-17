import * as THREE from 'three';
import { DOOR_HEIGHT, WALL_HEIGHT, WALL_THICKNESS, type DoorSpan } from '../layout';
import { stdLin } from './assets';

/**
 * Pembangun dinding prosedural untuk ruangan Lantai 1 (dipakai sejak Tahap 1).
 *
 * Semua dinding dibangun memanjang sumbu X di koordinat LOKAL ruangannya. Untuk dinding
 * yang memanjang sumbu Z, bangun terpusat di 0 lalu putar grupnya dengan `alongZ()`.
 *
 * Dinding di sini TIDAK melempar bayangan: semuanya berada di sisi selatan/timur atau di
 * antara dua ruangan, jadi bayangannya akan jatuh ke lantai ruangan dan tetap terlihat
 * walaupun dindingnya sedang dipudarkan Auto-Fade (bayangan "dinding hantu").
 */

function part(
  w: number, h: number, d: number,
  mat: THREE.Material,
  x: number, y: number, z: number,
  name: string,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.name = name;
  m.castShadow = false;
  m.receiveShadow = true;
  return m;
}

// ============================================================================
// Dinding penuh berpintu
// ============================================================================
export interface SolidWallMaterials {
  body: THREE.Material;
  /** Kusen pintu. */
  frame: THREE.Material;
  cap?: THREE.Material;
  base?: THREE.Material;
  inset?: THREE.Material;
  threshold?: THREE.Material;
}

export interface SolidWallOpts {
  name: string;
  xMin: number;
  xMax: number;
  /** Pusat tebal dinding (tebal WALL_THICKNESS). */
  z: number;
  doors?: readonly DoorSpan[];
  mats: SolidWallMaterials;
  /** Tinggi badan dinding. Bawaan WALL_HEIGHT. */
  bodyHeight?: number;
  /** List trim di puncak dinding. */
  cap?: { width: number; yMin: number; yMax: number; xMin?: number; xMax?: number };
  /** Baseboard: `north` / `south` = tonjolan (m) dari muka dinding sisi itu; kosong = tanpa baseboard. */
  base?: { height: number; north?: number; south?: number };
  /** Panel inset tipis di muka dinding (gaya office_room_shell.glb). */
  inset?: { north?: boolean; south?: boolean };
  /** Pelat ambang di lantai bukaan pintu (menutup celah antar-lantai). */
  threshold?: { zMin: number; zMax: number; yMin: number; yMax: number };
}

/** Lebar kusen pintu dan tonjolannya dari muka dinding. */
const FRAME_W = 0.05;
const FRAME_PROUD = 0.015;

export function buildSolidWallX(o: SolidWallOpts): THREE.Group {
  const g = new THREE.Group();
  g.name = o.name;
  const T = WALL_THICKNESS;
  const H = o.bodyHeight ?? WALL_HEIGHT;
  const zN = o.z - T / 2;
  const zS = o.z + T / 2;
  const doors = [...(o.doors ?? [])].sort((a, b) => a.xMin - b.xMin);

  // Ruas padat di antara bukaan pintu
  const spans: Array<[number, number]> = [];
  let cursor = o.xMin;
  for (const d of doors) {
    if (d.xMin > cursor + 1e-4) spans.push([cursor, d.xMin]);
    cursor = d.xMax;
  }
  if (o.xMax > cursor + 1e-4) spans.push([cursor, o.xMax]);

  spans.forEach(([a, b], i) => {
    const len = b - a;
    const cx = (a + b) / 2;
    g.add(part(len, H, T, o.mats.body, cx, H / 2, o.z, `${o.name}_Body_${i}`));

    if (o.base && o.mats.base) {
      const { height, north, south } = o.base;
      if (north) g.add(part(len, height, north, o.mats.base, cx, height / 2, zN - north / 2, `${o.name}_Baseboard_N_${i}`));
      if (south) g.add(part(len, height, south, o.mats.base, cx, height / 2, zS + south / 2, `${o.name}_Baseboard_S_${i}`));
    }

    if (o.inset && o.mats.inset && len > 0.8) {
      const iw = len - 0.24;
      const ih = H - 0.35;
      const iy = 0.125 + ih / 2;
      if (o.inset.north) g.add(part(iw, ih, 0.036, o.mats.inset, cx, iy, zN - 0.015, `${o.name}_Inset_N_${i}`));
      if (o.inset.south) g.add(part(iw, ih, 0.036, o.mats.inset, cx, iy, zS + 0.015, `${o.name}_Inset_S_${i}`));
    }
  });

  doors.forEach((d, i) => {
    const w = d.xMax - d.xMin;
    const cx = (d.xMin + d.xMax) / 2;
    const depth = T + FRAME_PROUD * 2;
    g.add(part(w, H - DOOR_HEIGHT, T, o.mats.body, cx, (DOOR_HEIGHT + H) / 2, o.z, `${o.name}_Lintel_${i}`));
    g.add(part(FRAME_W, DOOR_HEIGHT, depth, o.mats.frame, d.xMin + FRAME_W / 2, DOOR_HEIGHT / 2, o.z, `${o.name}_Door_Jamb_${i}_A`));
    g.add(part(FRAME_W, DOOR_HEIGHT, depth, o.mats.frame, d.xMax - FRAME_W / 2, DOOR_HEIGHT / 2, o.z, `${o.name}_Door_Jamb_${i}_B`));
    g.add(part(w - FRAME_W * 2, FRAME_W, depth, o.mats.frame, cx, DOOR_HEIGHT - FRAME_W / 2, o.z, `${o.name}_Door_Head_${i}`));
    if (o.threshold && o.mats.threshold) {
      const t = o.threshold;
      g.add(part(
        w - FRAME_W * 2, t.yMax - t.yMin, t.zMax - t.zMin, o.mats.threshold,
        cx, (t.yMin + t.yMax) / 2, (t.zMin + t.zMax) / 2, `${o.name}_Door_Threshold_${i}`,
      ));
    }
  });

  if (o.cap && o.mats.cap) {
    const a = o.cap.xMin ?? o.xMin;
    const b = o.cap.xMax ?? o.xMax;
    g.add(part(b - a, o.cap.yMax - o.cap.yMin, o.cap.width, o.mats.cap, (a + b) / 2, (o.cap.yMin + o.cap.yMax) / 2, o.z, `${o.name}_Top_Cap`));
  }
  return g;
}

// ============================================================================
// Dinding kaca berbingkai gelap (pembatas sementara Jalan Utama & dinding ruangan sisi bus)
// ============================================================================
export interface GlassWallMaterials {
  frame: THREE.Material;
  glass: THREE.Material;
  /** Strip kaca buram (privacy band) setinggi mata, opsional. */
  band?: THREE.Material;
  /** Pelat ambang di lantai bukaan pintu. Bawaan: material frame. */
  threshold?: THREE.Material;
}

export interface GlassWallOpts {
  name: string;
  xMin: number;
  xMax: number;
  z: number;
  /** Posisi X tiang utama tambahan (batas ruas antar-ruangan). */
  breaks?: readonly number[];
  mats: GlassWallMaterials;
  /** Y dasar curb: -0.02 bila berdiri di atas sub-slab, 0 bila di atas karpet. */
  yBase?: number;
  /** Jarak maksimum antar-tiang kecil. */
  maxBay?: number;
  /**
   * Bukaan pintu (tinggi DOOR_HEIGHT): curb terputus, tiang utama menjadi kusen, dan di
   * atasnya ada palang + kaca transom sampai header.
   */
  doors?: readonly DoorSpan[];
  /** Pelat ambang di lantai bukaan pintu (menutup celah antar-lantai). */
  threshold?: { zMin: number; zMax: number; yMin: number; yMax: number };
  /** Strip privacy band pada setiap panel kaca (butuh `mats.band`). */
  band?: { yMin: number; yMax: number };
}

const CURB_TOP = 0.11;
const HEADER_H = 0.08;
const MAJOR_POST = 0.1;
const MINOR_POST = 0.06;
const TRANSOM_BAR = 0.06;

export function buildGlassWallX(o: GlassWallOpts): THREE.Group {
  const g = new THREE.Group();
  g.name = o.name;
  const len = o.xMax - o.xMin;
  const cx = (o.xMin + o.xMax) / 2;
  const yBase = o.yBase ?? 0;
  const maxBay = o.maxBay ?? 2.0;
  const postBottom = CURB_TOP;
  const postTop = WALL_HEIGHT - HEADER_H;
  const postH = postTop - postBottom;
  const postY = (postBottom + postTop) / 2;
  const doors = [...(o.doors ?? [])].sort((a, b) => a.xMin - b.xMin);

  g.add(part(len, HEADER_H, 0.1, o.mats.frame, cx, WALL_HEIGHT - HEADER_H / 2, o.z, `${o.name}_Header`));

  // Ruas kaca di antara bukaan pintu. Tiang ujung ruas yang berbatasan pintu menjadi kusen,
  // jadi lebar bersih bukaan = xMax - xMin pintu.
  const spans: Array<[number, number]> = [];
  let cursor = o.xMin;
  for (const d of doors) {
    if (d.xMin > cursor + 1e-4) spans.push([cursor, d.xMin]);
    cursor = d.xMax;
  }
  if (o.xMax > cursor + 1e-4) spans.push([cursor, o.xMax]);

  const majors: number[] = [];
  spans.forEach(([a, b], s) => {
    g.add(part(b - a, CURB_TOP - yBase, WALL_THICKNESS, o.mats.frame, (a + b) / 2, (yBase + CURB_TOP) / 2, o.z, spans.length > 1 ? `${o.name}_Curb_${s}` : `${o.name}_Curb`));
    majors.push(
      a + MAJOR_POST / 2,
      ...(o.breaks ?? []).filter((x) => x > a + 0.2 && x < b - 0.2),
      b - MAJOR_POST / 2,
    );
  });
  majors.sort((a, b) => a - b);
  majors.forEach((x, i) => {
    g.add(part(MAJOR_POST, postH, MAJOR_POST, o.mats.frame, x, postY, o.z, `${o.name}_Post_${i}`));
  });

  // Panel kaca per ruas + tiang kecil di dalam ruas (bukaan pintu dilewati)
  const isDoorGap = (a: number, b: number) => doors.some((d) => a >= d.xMin - 1e-3 && b <= d.xMax + 1e-3);
  const minors: number[] = [];
  for (let i = 0; i < majors.length - 1; i++) {
    const a = majors[i]! + MAJOR_POST / 2;
    const b = majors[i + 1]! - MAJOR_POST / 2;
    if (b - a < 0.05 || isDoorGap(a, b)) continue;
    const pane = part(b - a, postH, 0.02, o.mats.glass, (a + b) / 2, postY, o.z, `${o.name}_Glass_${i}`);
    g.add(pane);
    if (o.band && o.mats.band) {
      const { yMin, yMax } = o.band;
      g.add(part(b - a, yMax - yMin, 0.026, o.mats.band, (a + b) / 2, (yMin + yMax) / 2, o.z, `${o.name}_Band_${i}`));
    }
    const bays = Math.max(1, Math.ceil((b - a) / maxBay));
    for (let k = 1; k < bays; k++) minors.push(a + ((b - a) * k) / bays);
  }

  // Palang + kaca transom di atas pintu, pelat ambang di lantai
  doors.forEach((d, i) => {
    const w = d.xMax - d.xMin;
    const dx = (d.xMin + d.xMax) / 2;
    g.add(part(w, TRANSOM_BAR, MAJOR_POST, o.mats.frame, dx, DOOR_HEIGHT + TRANSOM_BAR / 2, o.z, `${o.name}_Door_Head_${i}`));
    const tBottom = DOOR_HEIGHT + TRANSOM_BAR;
    if (postTop - tBottom > 0.05) {
      g.add(part(w, postTop - tBottom, 0.02, o.mats.glass, dx, (tBottom + postTop) / 2, o.z, `${o.name}_Transom_${i}`));
    }
    if (o.threshold) {
      const t = o.threshold;
      g.add(part(
        w, t.yMax - t.yMin, t.zMax - t.zMin, o.mats.threshold ?? o.mats.frame,
        dx, (t.yMin + t.yMax) / 2, (t.zMin + t.zMax) / 2, `${o.name}_Door_Threshold_${i}`,
      ));
    }
  });
  if (minors.length > 0) {
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(MINOR_POST, postH, MINOR_POST), o.mats.frame, minors.length);
    inst.name = `${o.name}_Mullions`;
    const m = new THREE.Matrix4();
    minors.forEach((x, i) => {
      m.makeTranslation(x, postY, o.z);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = false;
    inst.receiveShadow = true;
    g.add(inst);
  }
  return g;
}

/** Putar dinding yang dibangun memanjang X (terpusat di 0) agar memanjang Z di posisi (x, zCenter). */
export function alongZ(wall: THREE.Group, x: number, zCenter: number) {
  wall.rotation.y = -Math.PI / 2;
  wall.position.set(x, 0, zCenter);
  return wall;
}

// ============================================================================
// Palet material (warna linear disalin dari GLB agar sambungan tidak terlihat)
// ============================================================================
/** Gaya dinding office_room_shell.glb (ruang kerja). */
export function workspaceWallMats(): SolidWallMaterials {
  const metal = stdLin([0.009, 0.023, 0.03], 0.32, 0.78);
  return {
    body: stdLin([0.009, 0.019, 0.024], 0.9, 0.04),
    inset: stdLin([0.012, 0.026, 0.033], 0.86, 0.05),
    base: stdLin([0.009, 0.02, 0.025], 0.74, 0.03),
    cap: metal,
    frame: metal,
    threshold: stdLin([0.004, 0.009, 0.011], 0.4, 0.68),
  };
}

/** Gaya dinding Office_Boardroom_Shell.glb (ruang rapat & foyer). */
export function boardroomWallMats(): SolidWallMaterials {
  const anodized = stdLin([0.019, 0.025, 0.03], 0.38, 0.85);
  return {
    body: stdLin([0.009, 0.019, 0.024], 0.86, 0),
    base: stdLin([0.022, 0.011, 0.006], 0.58, 0),
    cap: stdLin([0.479, 0.515, 0.539], 0.32, 0.92),
    frame: anodized,
    threshold: anodized,
  };
}

/** Kaca gelap (smoked) + privacy band buram untuk ruang privat (Ruang Manajer). */
export function smokedGlassWallMats(): GlassWallMaterials {
  const glass = (color: number, opacity: number, roughness: number) => new THREE.MeshStandardMaterial({
    color, roughness, metalness: 0.1, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
  });
  return {
    frame: stdLin([0.009, 0.023, 0.03], 0.35, 0.75),
    glass: glass(0x4a5d66, 0.38, 0.12),
    band: glass(0xd7e2e6, 0.5, 0.6),
    threshold: stdLin([0.019, 0.025, 0.03], 0.38, 0.85),
  };
}

/** Ambang kuningan (Pantry / Café). */
export function brassMat() {
  return stdLin([0.56, 0.38, 0.13], 0.32, 0.95);
}

/** Kaca berbingkai gelap (serasi sekat kaca ruang kerja & koridor kaca lama). */
export function glassWallMats(): GlassWallMaterials {
  return {
    frame: stdLin([0.009, 0.023, 0.03], 0.35, 0.75),
    glass: new THREE.MeshStandardMaterial({
      color: 0xb9e3e8,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  };
}
