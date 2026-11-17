import * as THREE from 'three';
import { WALL_HEIGHT, WALL_THICKNESS, type SouthRoomSpec } from '../layout';
import type { WallFader } from '../camera/wallFade';
import { box, stdLin } from './assets';
import {
  alongZ,
  buildGlassWallX,
  buildSolidWallX,
  workspaceWallMats,
  type GlassWallMaterials,
  type SolidWallMaterials,
} from './walls';

/**
 * Cangkang ruangan di sisi SELATAN Jalan Utama (Tahap 2+: Ruang Manajer, Pantry / Café;
 * kelak Lobi, Lounge, Server / IT, dst.). Semua dinding berdiri di dalam tapak ruangan:
 *
 * - Utara  : dinding kaca berpintu di garis kaca sementara Jalan Utama (dunia Z 7.40..7.64),
 *            berdiri di atas sub-slab koridor. Selalu memudar di tampilan rumah boneka
 *            (dinding dalam antara koridor dan ruangan).
 * - Selatan: dinding luar gedung (memudar bila kamera di luarnya).
 * - Barat / Timur: dinding perimeter, atau dinding dalam (`interiorSides`) bila berbatasan
 *            dengan ruangan lain, termasuk ruangan tahap berikutnya. Sisi yang sudah ditutup
 *            dinding milik tetangga dilewati (`sides`), mis. Lobi di antara Manajer & Pantry.
 * - Utara bisa juga dinding penuh berpintu (`north: 'solid'`), mis. partisi akustik Server / IT.
 *
 * Lantai (karpet / keramik) dan isi ruangan dipasang oleh modul ruangannya.
 */
export type SideWall = 'west' | 'east';

export interface SouthRoomShell {
  group: THREE.Group;
  /** Buat sub-layer bernama di dalam grup ruangan. */
  sub: (name: string) => THREE.Group;
  walls: { north: THREE.Group; south: THREE.Group; west: THREE.Group; east: THREE.Group };
  /** Muka dalam dinding (lokal): batas bersih lantai ruangan. */
  inner: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Titik lokal → dunia. */
  local: (x: number, y: number, z: number) => THREE.Vector3;
  /** Daftarkan ke-4 dinding ke Auto-Fade setelah ruangan dipasang di hierarki gedung. */
  bindWalls: () => void;
}

export function buildSouthRoomShell(o: {
  spec: SouthRoomSpec;
  fader: WallFader;
  /** Awalan id WallFader, mis. `manager` → `manager_north`, `manager_south`, ... */
  fadeId: string;
  glass: GlassWallMaterials;
  /** Strip privacy band pada kaca utara (butuh `glass.band`). */
  glassBand?: { yMin: number; yMax: number };
  solid?: SolidWallMaterials;
  interiorSides: readonly SideWall[];
  /** Dinding samping yang dibangun ruangan ini (bawaan keduanya). */
  sides?: { west?: boolean; east?: boolean };
  /** Jenis dinding utara: kaca (bawaan) atau dinding penuh berpintu. */
  north?: 'glass' | 'solid';
  /** Material dinding utara bila `north: 'solid'` (bawaan = material dinding lain). */
  northSolid?: SolidWallMaterials;
}): SouthRoomShell {
  const { spec, fader } = o;
  const T = WALL_THICKNESS;
  const hx = spec.halfX;
  const hz = spec.halfZ;

  const group = new THREE.Group();
  group.name = spec.name;
  group.position.set(spec.origin.x, 0, spec.origin.z);

  const sub = (name: string) => {
    const g = new THREE.Group();
    g.name = name;
    group.add(g);
    return g;
  };
  const architecture = sub('SubLayer_Architecture');

  // ---- Sub-slab slate: dari muka selatan dinding utara sampai tepi selatan tapak.
  // Pita di bawah dinding utara (Z 7.40..7.64) sudah ditopang sub-slab Jalan Utama.
  const slab = box(hx * 2, 0.28, hz * 2 - T, stdLin([0.009, 0.019, 0.024], 0.9, 0), [0, -0.16, T / 2], `${spec.name}_SubSlab`);
  slab.castShadow = false;
  architecture.add(slab);

  // ---- Utara: kaca (bawaan) atau dinding penuh, berpintu ke Jalan Utama + pelat ambang ----
  const mats = o.solid ?? workspaceWallMats();
  const cap = { width: 0.16, yMin: WALL_HEIGHT - 0.085, yMax: WALL_HEIGHT + 0.015 };
  // Dari tepi karpet Jalan Utama (Z 7.40) sampai lantai ruangan (Z 7.64).
  const threshold = { zMin: -hz, zMax: -hz + T, yMin: -0.02, yMax: 0.003 };
  const north = o.north === 'solid'
    ? buildSolidWallX({
      name: 'North_Wall',
      xMin: -hx,
      xMax: hx,
      z: -hz + T / 2,
      doors: [spec.northDoor],
      mats: o.northSolid ?? mats,
      cap,
      base: { height: 0.12, north: 0.02, south: 0.02 },
      threshold,
    })
    : buildGlassWallX({
      name: 'North_Glass_Wall',
      xMin: -hx,
      xMax: hx,
      z: -hz + T / 2,
      doors: [spec.northDoor],
      mats: o.glass,
      yBase: -0.02,
      maxBay: 1.6,
      band: o.glassBand,
      threshold,
    });

  // ---- Selatan, Barat, Timur: dinding penuh gaya ruang kerja ----
  const south = buildSolidWallX({
    name: 'South_Wall',
    xMin: -hx,
    xMax: hx,
    z: hz - T / 2,
    mats,
    cap,
    base: { height: 0.12, north: 0.02 },
  });
  // Dinding samping dibangun memanjang X lalu diputar: sisi "north" = +X, sisi "south" = -X.
  const sideLen = hz - T;
  const hasWest = o.sides?.west !== false;
  const hasEast = o.sides?.east !== false;
  const west = hasWest
    ? alongZ(buildSolidWallX({
      name: 'West_Wall', xMin: -sideLen, xMax: sideLen, z: 0, mats, cap,
      base: { height: 0.12, north: 0.02 },
    }), -hx + T / 2, 0)
    : new THREE.Group();
  const east = hasEast
    ? alongZ(buildSolidWallX({
      name: 'East_Wall', xMin: -sideLen, xMax: sideLen, z: 0, mats, cap,
      base: { height: 0.12, south: 0.02 },
    }), hx - T / 2, 0)
    : new THREE.Group();
  architecture.add(north, south, west, east);

  const local = (x: number, y: number, z: number) => {
    group.updateWorldMatrix(true, false);
    return group.localToWorld(new THREE.Vector3(x, y, z));
  };

  const bindWalls = () => {
    group.updateWorldMatrix(true, true);
    const dir = (x: number, z: number) => new THREE.Vector3(x, 0, z).transformDirection(group.matrixWorld);
    const isInterior = (s: SideWall) => o.interiorSides.includes(s);
    // Normal menghadap KE DALAM ruangan, titik di muka dalam dinding.
    fader.register(`${o.fadeId}_north`, [north], dir(0, 1), local(0, 0, -hz + T), { interior: true });
    fader.register(`${o.fadeId}_south`, [south], dir(0, -1), local(0, 0, hz - T));
    if (hasWest) fader.register(`${o.fadeId}_west`, [west], dir(1, 0), local(-hx + T, 0, 0), { interior: isInterior('west') });
    if (hasEast) fader.register(`${o.fadeId}_east`, [east], dir(-1, 0), local(hx - T, 0, 0), { interior: isInterior('east') });
  };

  return {
    group,
    sub,
    walls: { north, south, west, east },
    // Tanpa dinding sendiri, lantai sampai tepi tapak (muka dinding tetangga).
    inner: { minX: hasWest ? -hx + T : -hx, maxX: hasEast ? hx - T : hx, minZ: -hz + T, maxZ: hz - T },
    local,
    bindWalls,
  };
}
