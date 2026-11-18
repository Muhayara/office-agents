import * as THREE from 'three';
import { WALL_HEIGHT, WALL_THICKNESS, type DoorSpan, type NorthRoomSpec, type NorthTierSpec } from '../layout';
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
import type { SideWall } from './southWing';

/**
 * Cangkang ruangan di sisi UTARA Jalan Utama (Tahap 4+: Collaboration Commons, Workshop / Training).
 * Cermin dari `southWing.ts`; semua dinding berdiri di dalam tapak ruangan:
 *
 * - Selatan: dinding kaca berpintu di garis kaca sementara Jalan Utama (dunia Z 4.76..5.00).
 *            Selalu memudar di tampilan rumah boneka (dinding dalam antara koridor dan ruangan).
 * - Utara  : dinding penuh, boleh dipecah menjadi beberapa ruas (`northSegments`) dengan Auto-Fade
 *            sendiri-sendiri: ruas perimeter tetap solid dari kamera Tenggara, ruas yang berbatasan
 *            dengan baris utara kedua (Tahap 5) selalu memudar. Pintu terbuka diberi pelat ambang.
 * - Barat / Timur: dinding penuh atau kaca (`sideKind`), dinding dalam (`interiorSides`) bila
 *            berbatasan dengan ruangan lain, termasuk ruangan tahap berikutnya.
 *
 * Sub-slab menutup seluruh tapak (strip sub-slab bus sisi utara hanya ada di ruas yang belum dibangun).
 */
export interface NorthWallSegment {
  /** Akhiran id WallFader, mis. `north_west` → `commons_north_west`. */
  id: string;
  xMin: number;
  xMax: number;
  /** true = berbatasan dengan ruangan lain → selalu memudar di tampilan rumah boneka. */
  interior: boolean;
  doors?: readonly DoorSpan[];
  /** Pintu ruas ini terbuka (jalur navigasi): pasang pelat ambang di lantai bukaan. */
  openDoors?: boolean;
}

export interface NorthRoomShell {
  group: THREE.Group;
  sub: (name: string) => THREE.Group;
  walls: { north: THREE.Group; south: THREE.Group; west: THREE.Group; east: THREE.Group };
  /** Grup per ruas dinding utara (id ruas → grup), untuk menempelkan papan / daun pintu. */
  northSegments: Record<string, THREE.Group>;
  /** Muka dalam dinding (lokal): batas bersih lantai ruangan. */
  inner: { minX: number; maxX: number; minZ: number; maxZ: number };
  local: (x: number, y: number, z: number) => THREE.Vector3;
  bindWalls: () => void;
}

const CAP = { width: 0.16, yMin: WALL_HEIGHT - 0.085, yMax: WALL_HEIGHT + 0.015 };

export function buildNorthRoomShell(o: {
  spec: NorthRoomSpec;
  fader: WallFader;
  /** Awalan id WallFader, mis. `commons` → `commons_south`, `commons_north_west`, ... */
  fadeId: string;
  glass: GlassWallMaterials;
  solid?: SolidWallMaterials;
  interiorSides: readonly SideWall[];
  sides?: { west?: boolean; east?: boolean };
  /** Jenis dinding samping (bawaan: dinding penuh). */
  sideKind?: { west?: 'solid' | 'glass'; east?: 'solid' | 'glass' };
  /** Material dinding samping penuh per sisi (bawaan: `solid`). */
  sideMats?: { west?: SolidWallMaterials; east?: SolidWallMaterials };
  /** Ruas dinding utara (bawaan: satu ruas perimeter dengan `spec.northDoors`, pintu tertutup). */
  northSegments?: readonly NorthWallSegment[];
}): NorthRoomShell {
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

  const slab = box(hx * 2, 0.28, hz * 2, stdLin([0.009, 0.019, 0.024], 0.9, 0), [0, -0.16, 0], `${spec.name}_SubSlab`);
  slab.castShadow = false;
  architecture.add(slab);

  const mats = o.solid ?? workspaceWallMats();

  // ---- Selatan: kaca berpintu ke Jalan Utama + pelat ambang (lantai ruangan → karpet bus) ----
  const south = buildGlassWallX({
    name: 'South_Glass_Wall',
    xMin: -hx,
    xMax: hx,
    z: hz - T / 2,
    doors: [spec.southDoor],
    mats: o.glass,
    yBase: -0.02,
    maxBay: 1.6,
    threshold: { zMin: hz - T, zMax: hz, yMin: -0.02, yMax: 0.003 },
  });

  // ---- Utara: satu atau beberapa ruas dinding penuh ----
  const segments: readonly NorthWallSegment[] = o.northSegments ?? [
    { id: 'north', xMin: -hx, xMax: hx, interior: false, doors: spec.northDoors },
  ];
  const north = new THREE.Group();
  north.name = 'North_Wall_Segments';
  const northSegments: Record<string, THREE.Group> = {};
  for (const seg of segments) {
    const wall = buildSolidWallX({
      name: `North_Wall_${seg.id}`,
      xMin: seg.xMin,
      xMax: seg.xMax,
      z: -hz + T / 2,
      doors: seg.doors,
      mats,
      cap: { ...CAP, xMin: seg.xMin, xMax: seg.xMax },
      // Ruas dalam juga diberi baseboard di sisi ruangan utaranya.
      base: seg.interior ? { height: 0.12, north: 0.02, south: 0.02 } : { height: 0.12, south: 0.02 },
      threshold: seg.openDoors ? { zMin: -hz, zMax: -hz + T, yMin: -0.02, yMax: 0.003 } : undefined,
    });
    north.add(wall);
    northSegments[seg.id] = wall;
  }

  // ---- Barat / Timur: dinding samping di antara dinding utara & selatan ----
  const sideLen = hz - T;
  const hasWest = o.sides?.west !== false;
  const hasEast = o.sides?.east !== false;
  const side = (which: SideWall) => {
    const kind = o.sideKind?.[which] ?? 'solid';
    const name = which === 'west' ? 'West_Wall' : 'East_Wall';
    const x = which === 'west' ? -hx + T / 2 : hx - T / 2;
    const wall = kind === 'glass'
      ? buildGlassWallX({ name: `${name}_Glass`, xMin: -sideLen, xMax: sideLen, z: 0, mats: o.glass, yBase: -0.02, maxBay: 1.6 })
      : buildSolidWallX({
        name, xMin: -sideLen, xMax: sideLen, z: 0, mats: o.sideMats?.[which] ?? mats, cap: CAP,
        // Dinding dibangun memanjang X lalu diputar: sisi "north" = +X dunia, "south" = -X dunia.
        base: which === 'west' ? { height: 0.12, north: 0.02 } : { height: 0.12, south: 0.02 },
      });
    return alongZ(wall, x, 0);
  };
  const west = hasWest ? side('west') : new THREE.Group();
  const east = hasEast ? side('east') : new THREE.Group();
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
    fader.register(`${o.fadeId}_south`, [south], dir(0, -1), local(0, 0, hz - T), { interior: true });
    for (const seg of segments) {
      fader.register(`${o.fadeId}_${seg.id}`, [northSegments[seg.id]!], dir(0, 1), local((seg.xMin + seg.xMax) / 2, 0, -hz + T), { interior: seg.interior });
    }
    if (hasWest) fader.register(`${o.fadeId}_west`, [west], dir(1, 0), local(-hx + T, 0, 0), { interior: isInterior('west') });
    if (hasEast) fader.register(`${o.fadeId}_east`, [east], dir(-1, 0), local(hx - T, 0, 0), { interior: isInterior('east') });
  };

  return {
    group,
    sub,
    walls: { north, south, west, east },
    northSegments,
    inner: { minX: hasWest ? -hx + T : -hx, maxX: hasEast ? hx - T : hx, minZ: -hz + T, maxZ: hz - T },
    local,
    bindWalls,
  };
}

/**
 * Cangkang ruangan BARIS UTARA KEDUA (Tahap 5+: Information Wall, Collaboration Pods; kelak Studio).
 * Tapak dunia Z -5..-1. Tidak punya dinding selatan: dinding di Z -1.0..-0.76 milik ruangan di
 * selatannya (sudah memudar). Utara = dinding luar gedung (solid dari kamera Tenggara); barat / timur
 * dinding penuh, perimeter atau dinding dalam (`interiorSides`). Sisi yang dimiliki tetangga dilewati.
 */
export interface NorthTierShell {
  group: THREE.Group;
  sub: (name: string) => THREE.Group;
  walls: { north: THREE.Group; west: THREE.Group; east: THREE.Group };
  inner: { minX: number; maxX: number; minZ: number; maxZ: number };
  local: (x: number, y: number, z: number) => THREE.Vector3;
  bindWalls: () => void;
}

export function buildNorthTierShell(o: {
  spec: NorthTierSpec;
  fader: WallFader;
  fadeId: string;
  solid?: SolidWallMaterials;
  interiorSides: readonly SideWall[];
  sides?: { west?: boolean; east?: boolean };
}): NorthTierShell {
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
  const slab = box(hx * 2, 0.28, hz * 2, stdLin([0.009, 0.019, 0.024], 0.9, 0), [0, -0.16, 0], `${spec.name}_SubSlab`);
  slab.castShadow = false;
  architecture.add(slab);
  const mats = o.solid ?? workspaceWallMats();

  const north = buildSolidWallX({
    name: 'North_Wall_Exterior', xMin: -hx, xMax: hx, z: -hz + T / 2, mats, cap: CAP, base: { height: 0.12, south: 0.02 },
  });
  // Dinding samping dari muka dalam dinding utara sampai batas selatan tapak (Z lokal +hz).
  const sideLen = hz * 2 - T;
  const sideZ = T / 2;
  const hasWest = o.sides?.west !== false;
  const hasEast = o.sides?.east !== false;
  const side = (which: SideWall) => alongZ(buildSolidWallX({
    name: which === 'west' ? 'West_Wall' : 'East_Wall',
    xMin: -sideLen / 2, xMax: sideLen / 2, z: 0, mats, cap: CAP,
    base: which === 'west' ? { height: 0.12, north: 0.02 } : { height: 0.12, south: 0.02 },
  }), which === 'west' ? -hx + T / 2 : hx - T / 2, sideZ);
  const west = hasWest ? side('west') : new THREE.Group();
  const east = hasEast ? side('east') : new THREE.Group();
  architecture.add(north, west, east);

  const local = (x: number, y: number, z: number) => {
    group.updateWorldMatrix(true, false);
    return group.localToWorld(new THREE.Vector3(x, y, z));
  };
  const bindWalls = () => {
    group.updateWorldMatrix(true, true);
    const dir = (x: number, z: number) => new THREE.Vector3(x, 0, z).transformDirection(group.matrixWorld);
    const isInterior = (s: SideWall) => o.interiorSides.includes(s);
    fader.register(`${o.fadeId}_north`, [north], dir(0, 1), local(0, 0, -hz + T));
    if (hasWest) fader.register(`${o.fadeId}_west`, [west], dir(1, 0), local(-hx + T, 0, 0), { interior: isInterior('west') });
    if (hasEast) fader.register(`${o.fadeId}_east`, [east], dir(-1, 0), local(hx - T, 0, 0), { interior: isInterior('east') });
  };
  return {
    group,
    sub,
    walls: { north, west, east },
    inner: { minX: hasWest ? -hx + T : -hx, maxX: hasEast ? hx - T : hx, minZ: -hz + T, maxZ: hz },
    local,
    bindWalls,
  };
}
