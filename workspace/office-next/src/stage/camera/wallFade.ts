import * as THREE from 'three';

/**
 * Auto-Fade Wall ala The Sims (plan §3C, diperluas di Tahap 1 untuk gedung banyak ruangan).
 *
 * Ada dua mode tampilan:
 *
 * 1. RUMAH BONEKA: kamera isometrik, atau Free Cam yang berada di luar gedung / lebih tinggi
 *    dari dinding. Dinding yang menghalangi isi ruangan memudar ke opacity 0.15:
 *    - Dinding TEPI (perimeter) didaftarkan dengan normal menghadap KE DALAM dan satu titik di
 *      permukaan dalamnya; ia memudar bila kamera berada di belakangnya (dot < 0).
 *      Kamera ortografis memakai arah pandang, kamera perspektif memakai posisinya.
 *    - Dinding DALAM (`interior`: di antara dua ruangan) selalu memudar, karena dari sisi mana
 *      pun ia menutupi salah satu ruangan di baliknya.
 *
 * 2. JALAN KAKI: Free Cam berada di dalam tapak gedung dan di bawah tinggi dinding. Tidak ada
 *    dinding yang memudar: semua berdiri utuh sehingga bisa menyusuri ruangan lewat pintu.
 */
const FADED_OPACITY = 0.15;

/** Tapak ruangan di dunia (untuk menentukan kamera Free Cam sedang di dalam gedung). */
export interface WalkZone { minX: number; maxX: number; minZ: number; maxZ: number }

interface FadeMat {
  mat: THREE.Material;
  baseOpacity: number;
  baseTransparent: boolean;
  baseDepthWrite: boolean;
}

interface WallEntry {
  id: string;
  roots: THREE.Object3D[];
  normal: THREE.Vector3;
  point: THREE.Vector3;
  interior: boolean;
  opacity: number;
  fadeMode: boolean;
  mats: FadeMat[];
}

export class WallFader {
  private walls = new Map<string, WallEntry>();
  private tmp = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private zones: WalkZone[] = [];
  private walkMaxY = 0;

  /** Tapak gedung + tinggi dinding: di dalamnya Free Cam masuk mode jalan kaki (dinding utuh). */
  setWalkZones(zones: WalkZone[], maxY: number) {
    this.zones = zones;
    this.walkMaxY = maxY;
  }

  /**
   * Daftarkan / perbarui dinding. normal & point dalam koordinat dunia.
   * `interior: true` untuk dinding di antara dua ruangan (lihat catatan di atas).
   */
  register(
    id: string,
    roots: THREE.Object3D[],
    normal: THREE.Vector3,
    point: THREE.Vector3,
    opts: { interior?: boolean } = {},
  ) {
    const prev = this.walls.get(id);
    if (prev) this.restore(prev);
    const entry: WallEntry = {
      id,
      roots: roots.filter(Boolean),
      normal: normal.clone().normalize(),
      point: point.clone(),
      interior: opts.interior === true,
      opacity: prev?.opacity ?? 1,
      fadeMode: false,
      mats: [],
    };
    this.collect(entry);
    this.walls.set(id, entry);
  }

  /** Kumpulkan ulang material (dipanggil setelah placeholder diganti GLB). */
  refresh(id?: string) {
    for (const entry of this.walls.values()) {
      if (id && entry.id !== id) continue;
      this.restore(entry);
      this.collect(entry);
    }
  }

  update(camera: THREE.Camera, dt: number) {
    const ortho = (camera as THREE.OrthographicCamera).isOrthographicCamera === true;
    if (ortho) camera.getWorldDirection(this.dir).negate();
    const walking = !ortho && this.isWalking(camera.position);
    const k = Math.min(1, dt * 6);
    for (const w of this.walls.values()) {
      let behind: boolean;
      if (walking) {
        behind = false;
      } else if (w.interior) {
        behind = true;
      } else if (ortho) {
        behind = w.normal.dot(this.dir) < -0.02;
      } else {
        this.tmp.copy(camera.position).sub(w.point);
        behind = w.normal.dot(this.tmp) < 0;
      }
      const target = behind ? FADED_OPACITY : 1;
      if (Math.abs(w.opacity - target) < 0.002 && w.fadeMode === (target < 1)) continue;
      w.opacity += (target - w.opacity) * k;
      if (Math.abs(w.opacity - target) < 0.002) w.opacity = target;
      this.apply(w);
    }
  }

  private isWalking(p: THREE.Vector3) {
    if (p.y >= this.walkMaxY) return false;
    for (const z of this.zones) {
      if (p.x >= z.minX && p.x <= z.maxX && p.z >= z.minZ && p.z <= z.maxZ) return true;
    }
    return false;
  }

  private apply(w: WallEntry) {
    const fading = w.opacity < 0.995;
    if (fading !== w.fadeMode) {
      w.fadeMode = fading;
      for (const f of w.mats) {
        f.mat.transparent = fading ? true : f.baseTransparent;
        f.mat.depthWrite = fading ? false : f.baseDepthWrite;
        f.mat.needsUpdate = true;
      }
    }
    for (const f of w.mats) f.mat.opacity = fading ? f.baseOpacity * w.opacity : f.baseOpacity;
  }

  private restore(w: WallEntry) {
    for (const f of w.mats) {
      f.mat.transparent = f.baseTransparent;
      f.mat.depthWrite = f.baseDepthWrite;
      f.mat.opacity = f.baseOpacity;
      f.mat.needsUpdate = true;
    }
    w.mats = [];
    w.fadeMode = false;
  }

  private collect(w: WallEntry) {
    const seen = new Set<THREE.Material>();
    for (const root of w.roots) {
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        // Material GLB sering dipakai bersama lantai / objek lain: klon sekali per mesh.
        if (!mesh.userData.fadeOwned) {
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map((m) => m.clone())
            : mesh.material.clone();
          mesh.userData.fadeOwned = true;
        }
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (seen.has(mat)) continue;
          seen.add(mat);
          w.mats.push({
            mat,
            baseOpacity: mat.opacity,
            baseTransparent: mat.transparent,
            baseDepthWrite: mat.depthWrite,
          });
        }
      });
    }
    this.apply(w);
  }
}
