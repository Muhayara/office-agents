import * as THREE from 'three';
import {
  BUS_FRONTAGE_NORTH,
  BUS_FRONTAGE_SOUTH,
  CORRIDOR_BUS,
  WALL_THICKNESS,
  type BusFrontage,
} from '../layout';
import type { WallFader } from '../camera/wallFade';
import { box, createCarpetFloor, stdLin } from './assets';
import { alongZ, buildGlassWallX, glassWallMats } from './walls';

/**
 * LAYER JALAN UTAMA: Corridor_MainBus (Tahap 1), pusat dunia (12.0, 6.2), 38 × 2,4 m.
 *
 * Topologi bus Barat–Timur: setiap ruangan Lantai 1 membuka pintu ke koridor ini.
 * Origin = pusat lantai; sumbu panjang searah X (lokal -19..19), lebar Z lokal -1.2..1.2.
 *
 * Dinding tepi:
 * - Utara ruas barat (dunia X -7..15) adalah dinding selatan ruang kerja & foyer (milik ruangan itu).
 * - Sisanya dinding kaca sementara per ruas `BUS_FRONTAGE_*`. Dinding berdiri di SISI RUANGAN
 *   (di luar lebar 2,4 m), jadi lebar koridor tidak berubah saat ruangannya dibangun.
 */
export interface MainCorridor {
  group: THREE.Group;
  setCarpetMaterial: (mat: THREE.MeshStandardMaterial) => void;
  /** Daftarkan dinding ke Auto-Fade setelah koridor dipasang di hierarki gedung. */
  bindWalls: () => void;
  focusPoint: () => THREE.Vector3;
}

/** Gabungkan ruas yang belum dibangun dan bersebelahan menjadi satu bentang dinding kaca. */
function openRuns(frontage: readonly BusFrontage[]) {
  const runs: Array<{ xMin: number; xMax: number; breaks: number[] }> = [];
  for (const f of frontage) {
    if (f.built) continue;
    const last = runs[runs.length - 1];
    if (last && Math.abs(last.xMax - f.xMin) < 1e-6) {
      last.breaks.push(f.xMin);
      last.xMax = f.xMax;
    } else {
      runs.push({ xMin: f.xMin, xMax: f.xMax, breaks: [] });
    }
  }
  return runs;
}

export function buildMainCorridor(fader: WallFader): MainCorridor {
  const group = new THREE.Group();
  group.name = CORRIDOR_BUS.name;
  group.position.set(CORRIDOR_BUS.origin.x, 0, CORRIDOR_BUS.origin.z);

  const sub = (name: string) => {
    const g = new THREE.Group();
    g.name = name;
    group.add(g);
    return g;
  };
  const floor = sub('SubLayer_Floor');
  const wallsSouth = sub('SubLayer_TempWalls_South');
  const wallsNorth = sub('SubLayer_TempWalls_North');
  const wallWest = sub('SubLayer_Terminator_West');
  const wallEast = sub('SubLayer_Terminator_East');

  const L = CORRIDOR_BUS.halfLength * 2;
  const halfW = CORRIDOR_BUS.halfWidth;
  const T = WALL_THICKNESS;
  /** X dunia → X lokal koridor. */
  const lx = (worldX: number) => worldX - CORRIDOR_BUS.origin.x;

  // ---- Lantai: sub-slab slate (ikut menopang dinding selatan) + karpet + LED pemandu tepi ----
  const slate = stdLin([0.009, 0.019, 0.024], 0.9, 0);
  const slab = box(L, 0.28, halfW * 2 + T, slate, [0, -0.16, T / 2], 'Bus_SubSlab');
  slab.castShadow = false;
  floor.add(slab);
  const carpet = createCarpetFloor(L, halfW * 2, [0, -0.01, 0], 'Bus_Acoustic_Carpet');
  floor.add(carpet.mesh);
  const led = stdLin([0.004, 0.012, 0.014], 0.4, 0.1, { emissive: 0x5ed9e7, emissiveIntensity: 1.2 });
  for (const z of [-halfW + 0.14, halfW - 0.14]) {
    const strip = box(L - 0.6, 0.004, 0.03, led, [0, 0.002, z], 'Bus_LED_Guide');
    strip.castShadow = false;
    strip.receiveShadow = false;
    floor.add(strip);
  }

  // ---- Dinding kaca sementara sisi selatan (seluruh panjang yang belum dibangun) ----
  const zSouth = halfW + T / 2;
  for (const run of openRuns(BUS_FRONTAGE_SOUTH)) {
    wallsSouth.add(buildGlassWallX({
      name: `Bus_South_Glass_${run.xMin}_${run.xMax}`,
      xMin: lx(run.xMin),
      xMax: lx(run.xMax),
      z: zSouth,
      breaks: run.breaks.map(lx),
      mats: glassWallMats(),
      yBase: -0.02,
    }));
  }

  // ---- Dinding kaca sementara sisi utara ruas timur + sub-slab di bawahnya ----
  const zNorth = -halfW - T / 2;
  for (const run of openRuns(BUS_FRONTAGE_NORTH)) {
    const a = lx(run.xMin);
    const b = lx(run.xMax);
    const strip = box(b - a, 0.28, T, slate, [(a + b) / 2, -0.16, zNorth], 'Bus_SubSlab_North');
    strip.castShadow = false;
    floor.add(strip);
    wallsNorth.add(buildGlassWallX({
      name: `Bus_North_Glass_${run.xMin}_${run.xMax}`,
      xMin: a,
      xMax: b,
      z: zNorth,
      breaks: run.breaks.map(lx),
      mats: glassWallMats(),
      yBase: -0.02,
    }));
  }

  // ---- Terminator ujung barat & timur (di dalam tapak 38 m, di antara dua dinding panjang) ----
  const endWall = (name: string) => buildGlassWallX({
    name, xMin: -halfW, xMax: halfW, z: 0, mats: glassWallMats(), maxBay: 1.3,
  });
  wallWest.add(alongZ(endWall('Bus_West_End'), -CORRIDOR_BUS.halfLength + T / 2, 0));
  wallEast.add(alongZ(endWall('Bus_East_End'), CORRIDOR_BUS.halfLength - T / 2, 0));

  const local = (x: number, y: number, z: number) => {
    group.updateWorldMatrix(true, false);
    return group.localToWorld(new THREE.Vector3(x, y, z));
  };

  return {
    group,
    setCarpetMaterial: carpet.applyMaterial,
    bindWalls: () => {
      group.updateWorldMatrix(true, true);
      const dir = (x: number, z: number) => new THREE.Vector3(x, 0, z).transformDirection(group.matrixWorld);
      // Sisi luar tapak yang sudah dibangun: memudar hanya bila kamera berada di luarnya.
      fader.register('bus_south', [wallsSouth], dir(0, -1), local(0, 0, halfW));
      fader.register('bus_north_east', [wallsNorth], dir(0, 1), local(0, 0, -halfW));
      fader.register('bus_west_end', [wallWest], dir(1, 0), local(-CORRIDOR_BUS.halfLength + T, 0, 0));
      fader.register('bus_east_end', [wallEast], dir(-1, 0), local(CORRIDOR_BUS.halfLength - T, 0, 0));
    },
    // Ruas inti: di antara pintu ruang kerja dan pintu foyer.
    focusPoint: () => local(lx(7.25), 1.05, 0),
  };
}
